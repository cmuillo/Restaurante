import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Quotation, QuotationStatus } from './entities/quotation.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { EmailConfigService } from '../settings/services/email-config.service';
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private readonly itemRepository: Repository<QuotationItem>,
    private readonly emailConfigService: EmailConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(branchId: string): Promise<Quotation[]> {
    return this.quotationRepository.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({ where: { id } });
    if (!quotation) throw new NotFoundException('Cotización no encontrada');
    return quotation;
  }

  async create(dto: CreateQuotationDto): Promise<Quotation> {
    // Calcular totales
    let subtotal = 0;
    let taxAmount = 0;

    const items: Partial<QuotationItem>[] = dto.items.map((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const lineTaxRate = item.taxRate ?? 13;
      const lineTax = lineTotal * (lineTaxRate / 100);
      subtotal += lineTotal;
      taxAmount += lineTax;
      return {
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        taxRate: lineTaxRate,
        subtotal: lineTotal,
      };
    });

    const discountAmount = dto.discountAmount ?? 0;
    const total = subtotal + taxAmount - discountAmount;

    // Generar número de cotización
    const count = await this.quotationRepository.count({ where: { branchId: dto.branchId } });
    const quotationNumber = `COT-${String(count + 1).padStart(6, '0')}`;

    const quotation = this.quotationRepository.create({
      branchId: dto.branchId,
      customerId: dto.customerId,
      quotationNumber,
      notes: dto.notes,
      discountAmount,
      subtotal,
      taxAmount,
      total,
      items: items as QuotationItem[],
    });

    return this.quotationRepository.save(quotation);
  }

  async update(id: string, dto: UpdateQuotationDto): Promise<Quotation> {
    const quotation = await this.findOne(id);

    if (quotation.status === QuotationStatus.INVOICED) {
      throw new BadRequestException('No se puede editar una cotización ya facturada');
    }

    // Si se actualizan los items, recalcular totales
    if (dto.items) {
      let subtotal = 0;
      let taxAmount = 0;

      const newItems: Partial<QuotationItem>[] = dto.items.map((item) => {
        const lineTotal = item.unitPrice * item.quantity;
        const lineTaxRate = item.taxRate ?? 13;
        subtotal += lineTotal;
        taxAmount += lineTotal * (lineTaxRate / 100);
        return {
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          taxRate: lineTaxRate,
          subtotal: lineTotal,
        };
      });

      const discountAmount = dto.discountAmount ?? quotation.discountAmount;
      const total = subtotal + taxAmount - Number(discountAmount);

      // Eliminar items anteriores y reemplazar
      await this.itemRepository.delete({ quotationId: id });

      await this.quotationRepository.save({
        ...quotation,
        customerId: dto.customerId ?? quotation.customerId,
        notes: dto.notes ?? quotation.notes,
        status: dto.status ?? quotation.status,
        discountAmount,
        subtotal,
        taxAmount,
        total,
        items: newItems as QuotationItem[],
      });
    } else {
      // Solo actualizar campos no-item
      await this.quotationRepository.update(id, {
        customerId: dto.customerId ?? quotation.customerId,
        notes: dto.notes !== undefined ? dto.notes : quotation.notes,
        status: dto.status ?? quotation.status,
        discountAmount: dto.discountAmount !== undefined ? dto.discountAmount : quotation.discountAmount,
      });
    }

    return this.findOne(id);
  }

  async sendEmail(id: string): Promise<{ message: string }> {
    const quotation = await this.findOne(id);

    if (!quotation.customer?.email) {
      throw new BadRequestException('El cliente no tiene correo electrónico registrado');
    }

    const emailConfig = await this.emailConfigService.getConfig();

    if (!emailConfig.isEnabled || !emailConfig.smtpHost) {
      throw new BadRequestException('El servicio de correo no está configurado. Contacta al administrador.');
    }

    const smtpPass = String(emailConfig.smtpPassword ?? '').replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpSecure,
      auth: { user: emailConfig.smtpUser, pass: smtpPass },
    });

    const itemsHtml = quotation.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${item.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">₡${Number(item.unitPrice).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">₡${Number(item.subtotal).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <h2 style="color:#ea580c;margin:0 0 8px">Cotización ${quotation.quotationNumber}</h2>
        <p style="color:#4b5563">Estimado/a <strong>${quotation.customer.name}</strong>,</p>
        <p style="color:#4b5563">Le presentamos la cotización solicitada con el detalle a continuación:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px;text-align:left">Producto</th>
              <th style="padding:8px;text-align:center">Cant.</th>
              <th style="padding:8px;text-align:right">P. Unit.</th>
              <th style="padding:8px;text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="text-align:right;padding:8px 0">
          <p style="margin:4px 0;color:#4b5563">Subtotal: <strong>₡${Number(quotation.subtotal).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</strong></p>
          <p style="margin:4px 0;color:#4b5563">IVA: <strong>₡${Number(quotation.taxAmount).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</strong></p>
          ${Number(quotation.discountAmount) > 0 ? `<p style="margin:4px 0;color:#ef4444">Descuento: <strong>-₡${Number(quotation.discountAmount).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</strong></p>` : ''}
          <p style="margin:8px 0;font-size:1.1em;color:#111827">Total: <strong>₡${Number(quotation.total).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</strong></p>
        </div>
        ${quotation.notes ? `<p style="color:#4b5563;margin-top:16px"><strong>Notas:</strong> ${quotation.notes}</p>` : ''}
        <p style="color:#9ca3af;font-size:0.85em;margin-top:24px">Esta cotización es válida por 30 días a partir de su emisión.</p>
      </div>`;

    await transporter.sendMail({
      from: `${emailConfig.senderName} <${emailConfig.senderEmail}>`,
      to: quotation.customer.email,
      subject: `Cotización ${quotation.quotationNumber}`,
      html,
    });

    await this.quotationRepository.update(id, { status: QuotationStatus.SENT });

    return { message: `Cotización enviada a ${quotation.customer.email}` };
  }

  /**
   * Crea una Order real desde la cotización para poder facturarla desde el BillingModal.
   * Retorna el objeto Order en el formato que espera el BillingModal.
   */
  async createOrder(id: string): Promise<Order | null> {
    const quotation = await this.findOne(id);

    if (quotation.status === QuotationStatus.INVOICED) {
      throw new BadRequestException('Esta cotización ya fue facturada');
    }

    const missingProduct = quotation.items.find((i) => !i.productId);
    if (missingProduct) {
      throw new BadRequestException(`El ítem "${missingProduct.productName}" no tiene producto asignado y no puede facturarse`);
    }

    const order = await this.dataSource.transaction(async (manager) => {
      // Siguiente número de orden
      const lastOrder = await manager.findOne(Order, {
        where: { branchId: quotation.branchId },
        order: { orderNumber: 'DESC' },
      });
      const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const subtotal = Number(quotation.subtotal);
      const taxAmount = Number(quotation.taxAmount);
      const discountAmount = Number(quotation.discountAmount);
      const total = Number(quotation.total);
      const taxPercentage = subtotal > 0 ? (taxAmount / subtotal) * 100 : 13;

      const notePrefix = `Originado de cotización ${quotation.quotationNumber}`;
      const finalNotes = quotation.notes
        ? `${notePrefix}. ${quotation.notes}`
        : notePrefix;

      const orderItems: Partial<OrderItem>[] = quotation.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        taxRate: Number(item.taxRate),
      }));

      const newOrder = manager.create(Order, {
        branchId: quotation.branchId,
        orderNumber,
        type: OrderType.TAKEOUT,
        status: OrderStatus.PENDING,
        customerId: quotation.customerId || undefined,
        notes: finalNotes,
        subtotal,
        taxPercentage,
        taxAmount,
        tipPercentage: 0,
        tipAmount: 0,
        discountAmount,
        total,
        items: orderItems as OrderItem[],
      });

      const savedOrder = await manager.save(Order, newOrder);

      // Marcar la cotización como facturada
      await manager.update(Quotation, id, { status: QuotationStatus.INVOICED });

      return savedOrder;
    });

    // Recargar con relaciones para el BillingModal
    return this.dataSource.getRepository(Order).findOne({
      where: { id: order.id },
      relations: ['customer', 'items'],
    });
  }
}
