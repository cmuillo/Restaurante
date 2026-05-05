import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { Order } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { HaciendaAuthService } from './hacienda-auth.service';
import { XmlBuilderService } from './xml-builder.service';
import { UpdateHaciendaConfigDto } from './dto/hacienda-config.dto';
import { XadesSignerService } from './xades-signer.service';
import { BuildXmlOptions } from './hacienda.types';
import { PaymentMethod } from '../billing/entities/invoice.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

/** Crea la clave numérica de 50 dígitos exigida por Hacienda */
function buildKey(params: {
  taxId: string;   // cédula del emisor sin guiones
  date: Date;
  consecutive: string;  // 20 dígitos
  securityCode: string; // 8 dígitos aleatorios
  situation?: '1' | '2' | '3'; // 1=normal 2=contingencia 3=sin internet
}): string {
  const d = params.date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const taxId = params.taxId.replace(/\D/g, '').padStart(12, '0');
  const situation = params.situation ?? '1';

  // Estructura: 506 + ddmmyy(6) + cédula(12) + consecutivo(20) + situacion(1) + seguridad(8) = 50
  return `506${day}${month}${year}${taxId}${params.consecutive}${situation}${params.securityCode}`;
}

/** Crea el número consecutivo de 20 dígitos */
function buildConsecutive(params: {
  branchCode: string;  // 3 dígitos
  terminalCode: string; // 5 dígitos
  docType: 'TE' | 'FE' | 'NC';
  sequence: number;     // número de factura (10 dígitos)
}): string {
  const docTypeCode = { TE: '04', FE: '01', NC: '03' }[params.docType];
  return `${params.branchCode.padStart(3, '0')}${params.terminalCode.padStart(5, '0')}${docTypeCode}${String(params.sequence).padStart(10, '0')}`;
}

/** Mapa de método de pago interno → código Hacienda */
function mapPaymentMethod(pm: PaymentMethod): '01' | '02' | '04' | '05' {
  const map: Record<PaymentMethod, '01' | '02' | '04' | '05'> = {
    [PaymentMethod.CASH]: '01',
    [PaymentMethod.CARD]: '02',
    [PaymentMethod.TRANSFER]: '04',
    [PaymentMethod.QR]: '04',
    [PaymentMethod.MIXED]: '05',
  };
  return map[pm] ?? '05';
}

@Injectable()
export class HaciendaService {
  private readonly logger = new Logger(HaciendaService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    private readonly authService: HaciendaAuthService,
    private readonly xmlBuilder: XmlBuilderService,
    private readonly signer: XadesSignerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Envía el comprobante a Hacienda para una factura ya creada en la DB.
   * Se llama automáticamente desde BillingService.createInvoice()
   */
  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'order.items', 'order.items.product'],
    });

    if (!invoice) {
      this.logger.error(`Factura ${invoiceId} no encontrada`);
      return;
    }

    const branchConfig = await this.configRepository.findOne({
      where: { branchId: invoice.order.branchId },
      relations: ['branch'],
    });

    if (!branchConfig) {
      this.logger.error(`Config de sucursal no encontrada para factura ${invoiceId}`);
      return;
    }

    // Hacienda deshabilitado → no enviar
    if (!branchConfig.haciendaEnabled) {
      this.logger.warn(`Hacienda deshabilitado para sucursal ${invoice.order.branchId}`);
      return;
    }

    // Cargar .p12 desde DB si el signer no está listo
    if (!this.signer.isReady() && branchConfig.haciendaP12Path && branchConfig.haciendaP12Password) {
      await this.signer.loadFromPath(branchConfig.haciendaP12Path, branchConfig.haciendaP12Password);
    }

    // Leer config desde DB, con fallback a .env para retrocompatibilidad
    const taxId = branchConfig.haciendaTaxId ?? this.config.get<string>('HACIENDA_ISSUER_TAX_ID');
    const taxIdType = ((branchConfig.haciendaTaxIdType ?? this.config.get<string>('HACIENDA_ISSUER_TAX_ID_TYPE')) ?? '02') as '01' | '02' | '03' | '04';
    const branchCode = branchConfig.haciendaBranchCode ?? this.config.get<string>('HACIENDA_BRANCH_CODE') ?? '001';
    const terminalCode = branchConfig.haciendaTerminalCode ?? this.config.get<string>('HACIENDA_TERMINAL_CODE') ?? '00001';

    if (!taxId) {
      this.logger.error(`taxId no configurado para sucursal ${invoice.order.branchId}`);
      await this.invoiceRepository.update(invoiceId, {
        haciendaStatus: 'error',
        haciendaMessage: 'Cédula del emisor no configurada. Configure Hacienda en el panel de administración.',
      });
      return;
    }

    // Determinar tipo de documento
    const docType = invoice.customerTaxId ? 'FE' : 'TE';

    // Número secuencial: extraemos el número del invoiceNumber (ej "F-000023" → 23)
    const sequence = parseInt(invoice.invoiceNumber.replace(/\D/g, ''), 10) || 1;

    const consecutive = buildConsecutive({ branchCode, terminalCode, docType, sequence });
    const securityCode = Math.floor(Math.random() * 1e8)
      .toString()
      .padStart(8, '0');
    const key = buildKey({ taxId, date: invoice.createdAt, consecutive, securityCode });

    // Construir líneas a partir de los ítems de la orden
    const lines = invoice.order.items?.map((item: OrderItem) => ({
      productName: item.product?.name ?? item.productName ?? 'Producto',
      quantity: item.quantity,
      unitPrice: parseFloat(String(item.unitPrice)),
      taxRate: item.taxRate == null
        ? parseFloat(String(branchConfig.taxPercentage ?? 13))
        : parseFloat(String(item.taxRate)),
      taxCode: item.taxCode ?? '01',
      discount: 0,
      unitOfMeasure: item.unitOfMeasure ?? 'Sp',
      cabysCode: item.cabysCode,
      commercialCodeType: item.commercialCodeType,
      commercialCode: item.commercialCode,
    })) ?? [];

    const xmlOpts: BuildXmlOptions = {
      docType,
      key,
      consecutive,
      date: invoice.createdAt,
      issuerName: branchConfig.branch?.name ?? 'Restaurante',
      issuerTaxId: taxId,
      issuerTaxIdType: taxIdType ?? '02',
      issuerCommercialName: branchConfig.branch?.name,
      issuerProvince: branchConfig.haciendaProvince ?? this.config.get('HACIENDA_PROVINCE') ?? '01',
      issuerCanton: branchConfig.haciendaCanton ?? this.config.get('HACIENDA_CANTON') ?? '01',
      issuerDistrict: branchConfig.haciendaDistrict ?? this.config.get('HACIENDA_DISTRICT') ?? '01',
      issuerAddress: branchConfig.branch?.address ?? 'Costa Rica',
      receiverName: invoice.customerName,
      receiverTaxId: invoice.customerTaxId,
      receiverEmail: undefined,
      lines,
      subtotal: parseFloat(String(invoice.subtotal)),
      discount: parseFloat(String(invoice.discountAmount)),
      taxAmount: parseFloat(String(invoice.taxAmount)),
      total: parseFloat(String(invoice.total)),
      paymentMethod: mapPaymentMethod(invoice.paymentMethod),
    };

    const xml = this.xmlBuilder.build(xmlOpts);
    const signedXml = this.signer.sign(xml);
    const xmlBase64 = Buffer.from(signedXml).toString('base64');

    // Actualizar la factura con la clave y XML antes de enviar
    await this.invoiceRepository.update(invoiceId, {
      haciendaKey: key,
      haciendaConsecutive: consecutive,
      haciendaDocType: docType,
      haciendaXml: xmlBase64,
      haciendaStatus: 'sending',
    });

    try {
      await this.postToHacienda(branchConfig, key, xmlBase64, invoice.createdAt);
      await this.invoiceRepository.update(invoiceId, { haciendaStatus: 'sent' });
      this.logger.log(`Comprobante ${key} enviado a Hacienda`);
      setTimeout(() => this.pollResponse(invoiceId, key, branchConfig, 1), 5_000);
    } catch (err) {
      this.logger.error(`Error enviando comprobante ${key}: ${err.message}`);
      await this.invoiceRepository.update(invoiceId, {
        haciendaStatus: 'error',
        haciendaMessage: err.message,
      });
    }
  }

  /** Envía el XML firmado a la API de recepción de Hacienda */
  private async postToHacienda(
    cfg: BranchConfig,
    key: string,
    xmlBase64: string,
    date: Date,
  ): Promise<void> {
    const apiUrl = cfg.haciendaApiUrl ?? this.config.get<string>('HACIENDA_API_URL');
    const token = await this.authService.getAccessToken(cfg);

    const body = {
      clave: key,
      fecha: date.toISOString(),
      emisor: {
        tipoIdentificacion: cfg.haciendaTaxIdType ?? this.config.get('HACIENDA_ISSUER_TAX_ID_TYPE'),
        numeroIdentificacion: cfg.haciendaTaxId ?? this.config.get('HACIENDA_ISSUER_TAX_ID'),
      },
      comprobanteXml: xmlBase64,
    };

    const resp = await fetch(`${apiUrl}/recepcion`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Hacienda recepción respondió ${resp.status}`);
  }

  /**
   * Consulta el estado del comprobante enviado.
   * Hacienda puede tardar segundos o minutos en procesar.
   * Se reintenta hasta 5 veces con espera exponencial.
   */
  async pollResponse(invoiceId: string, key: string, cfg: BranchConfig, attempt = 1): Promise<void> {
    if (attempt > 5) {
      this.logger.warn(`Comprobante ${key} sin respuesta tras 5 intentos`);
      return;
    }

    try {
      const apiUrl = cfg.haciendaApiUrl ?? this.config.get<string>('HACIENDA_API_URL');
      const token = await this.authService.getAccessToken(cfg);

      const resp = await fetch(`${apiUrl}/recepcion/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      const data = await resp.json() as Record<string, unknown>;

      const estado: string = (data?.ind_estado as string) ?? '';

      if (estado === 'aceptado') {
        await this.invoiceRepository.update(invoiceId, {
          haciendaStatus: 'accepted',
          haciendaResponseXml: data?.respuesta_xml ? String(data.respuesta_xml) : undefined,
          haciendaMessage: 'Comprobante aceptado por Hacienda',
          haciendaProcessedAt: new Date(),
        });
        this.logger.log(`Comprobante ${key} ACEPTADO por Hacienda`);
      } else if (estado === 'rechazado') {
        await this.invoiceRepository.update(invoiceId, {
          haciendaStatus: 'rejected',
          haciendaResponseXml: data?.respuesta_xml ? String(data.respuesta_xml) : undefined,
          haciendaMessage: data?.detalle_mensaje ? String(data.detalle_mensaje) : 'Comprobante rechazado',
          haciendaProcessedAt: new Date(),
        });
        this.logger.warn(`Comprobante ${key} RECHAZADO: ${data?.detalle_mensaje}`);
      } else {
        const delay = Math.min(attempt * 10_000, 60_000);
        setTimeout(() => this.pollResponse(invoiceId, key, cfg, attempt + 1), delay);
      }
    } catch (err) {
      this.logger.error(`Error consultando estado de ${key}: ${err.message}`);
      setTimeout(() => this.pollResponse(invoiceId, key, cfg, attempt + 1), attempt * 15_000);
    }
  }

  /** Reenvío manual (para facturas en estado error/rejected) */
  async resend(invoiceId: string): Promise<{ status: string }> {
    await this.invoiceRepository.update(invoiceId, { haciendaStatus: 'pending' });
    this.sendInvoice(invoiceId).catch((e) =>
      this.logger.error(`Error en reenvío manual ${invoiceId}: ${e.message}`),
    );
    return { status: 'queued' };
  }

  // ─── Config API ────────────────────────────────────────────────────────────

  /** Devuelve la config Hacienda de la sucursal (passwords enmascarados) */
  async getConfig(branchId: string) {
    const cfg = await this.configRepository.findOne({ where: { branchId } });
    if (!cfg) throw new NotFoundException(`Config de sucursal ${branchId} no encontrada`);

    return {
      haciendaEnabled: cfg.haciendaEnabled,
      haciendaTaxIdType: cfg.haciendaTaxIdType,
      haciendaTaxId: cfg.haciendaTaxId,
      haciendaIdpUrl: cfg.haciendaIdpUrl,
      haciendaApiUrl: cfg.haciendaApiUrl,
      haciendaClientId: cfg.haciendaClientId,
      haciendaUsername: cfg.haciendaUsername,
      haciendaPassword: cfg.haciendaPassword ? '••••••••' : null,
      haciendaProvince: cfg.haciendaProvince,
      haciendaCanton: cfg.haciendaCanton,
      haciendaDistrict: cfg.haciendaDistrict,
      haciendaBranchCode: cfg.haciendaBranchCode,
      haciendaTerminalCode: cfg.haciendaTerminalCode,
      haciendaP12Password: cfg.haciendaP12Password ? '••••••••' : null,
      haciendaEnvironment: cfg.haciendaEnvironment,
      haciendaP12Loaded: !!cfg.haciendaP12Path,
    };
  }

  /** Actualiza los campos Hacienda en BranchConfig */
  async updateConfig(branchId: string, dto: UpdateHaciendaConfigDto) {
    const cfg = await this.configRepository.findOne({ where: { branchId } });
    if (!cfg) throw new NotFoundException(`Config de sucursal ${branchId} no encontrada`);

    Object.assign(cfg, dto);
    const saved = await this.configRepository.save(cfg);

    if ((dto.haciendaP12Password !== undefined) && saved.haciendaP12Path) {
      await this.signer.loadFromPath(saved.haciendaP12Path, saved.haciendaP12Password);
    }

    return this.getConfig(branchId);
  }

  /** Guarda la ruta del .p12 subido y recarga el signer */
  async saveCertificatePath(branchId: string, filePath: string) {
    const cfg = await this.configRepository.findOne({ where: { branchId } });
    if (!cfg) throw new NotFoundException(`Config de sucursal ${branchId} no encontrada`);

    cfg.haciendaP12Path = filePath;
    const saved = await this.configRepository.save(cfg);

    if (saved.haciendaP12Password) {
      await this.signer.loadFromPath(filePath, saved.haciendaP12Password);
    }

    return { message: 'Certificado cargado correctamente' };
  }

  /** Últimas facturas con estado Hacienda para la sucursal */
  async getRecentStatuses(branchId: string, limit = 50) {
    return this.invoiceRepository
      .createQueryBuilder('inv')
      .innerJoin('inv.order', 'ord')
      .where('ord.branchId = :branchId', { branchId })
      .andWhere('inv.haciendaKey IS NOT NULL')
      .select([
        'inv.id',
        'inv.invoiceNumber',
        'inv.total',
        'inv.haciendaKey',
        'inv.haciendaConsecutive',
        'inv.haciendaDocType',
        'inv.haciendaStatus',
        'inv.haciendaMessage',
        'inv.haciendaProcessedAt',
        'inv.createdAt',
      ])
      .orderBy('inv.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
