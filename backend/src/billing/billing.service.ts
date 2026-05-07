import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import * as nodemailer from 'nodemailer';
import { Invoice, InvoiceStatus, PaymentMethod } from './entities/invoice.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto } from './dto/billing.dto';
import { HaciendaService } from '../hacienda/hacienda.service';
import { CustomersService } from '../customers/customers.service';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../menu/entities/product.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly haciendaService: HaciendaService,
    private readonly customersService: CustomersService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId?: string): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        relations: ['branch', 'items', 'table', 'customer'],
      });
      if (!order) throw new NotFoundException('Orden no encontrada');
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('La orden ya fue procesada o cancelada');
      }

      const config = await manager.findOne(BranchConfig, { where: { branchId: order.branchId } });

      // Generar número de factura secuencial
      const invoiceNumber = `${config?.invoicePrefix || 'F-'}${String(config?.invoiceNextNumber ?? 1).padStart(6, '0')}`;
      if (config) {
        await manager.update(BranchConfig, { branchId: order.branchId }, {
          invoiceNextNumber: (config.invoiceNextNumber ?? 0) + 1,
        });
      }

      let orderTotal = Number(order.total || 0);
      let orderTaxAmount = Number(order.taxAmount || 0);
      let orderSubtotal = Number(order.subtotal || 0);
      let pointsDiscount = 0;
      let pointsUsed = 0;

      // Procesar puntos si el cliente existe
      if (order.customerId && dto.pointsUsed && dto.pointsUsed > 0) {
        const customer = await manager.findOne(Customer, { where: { id: order.customerId } });
        if (customer && customer.loyaltyPoints >= dto.pointsUsed) {
          // Asumir 1 punto = 1 unidad de moneda para descuento
          pointsDiscount = Math.min(Number(dto.pointsUsed), orderTotal);
          orderTotal = Math.max(0, orderTotal - pointsDiscount);
          pointsUsed = dto.pointsUsed;

          // Deducir puntos usados del cliente
          await manager.update(Customer, { id: order.customerId }, {
            loyaltyPoints: customer.loyaltyPoints - pointsUsed,
          });
        }
      }
      const normalizedPaymentDetails: Record<string, number> = {};
      let expectedCashPortion = 0;
      let cashReceived = 0;
      let change = 0;

      if (dto.paymentMethod === PaymentMethod.MIXED) {
        const mixedCash = Number(dto.paymentDetails?.cash ?? 0);
        const mixedCard = Number(dto.paymentDetails?.card ?? 0);

        if (mixedCash <= 0 || mixedCard <= 0) {
          throw new BadRequestException('Para pago mixto debes indicar montos de efectivo y tarjeta mayores a cero');
        }

        const mixedTotal = mixedCash + mixedCard;
        if (Math.abs(mixedTotal - orderTotal) > 0.01) {
          throw new BadRequestException('La suma de efectivo y tarjeta debe ser igual al total a cobrar');
        }

        expectedCashPortion = mixedCash;
        normalizedPaymentDetails.cash = mixedCash;
        normalizedPaymentDetails.card = mixedCard;

        cashReceived = Number(dto.cashReceived ?? mixedCash);
        if (cashReceived < expectedCashPortion) {
          throw new BadRequestException('El efectivo recibido no cubre la porción en efectivo del pago mixto');
        }
        change = Math.max(0, cashReceived - expectedCashPortion);
      } else if (dto.paymentMethod === PaymentMethod.CASH) {
        expectedCashPortion = orderTotal;
        cashReceived = Number(dto.cashReceived ?? orderTotal);
        if (cashReceived < expectedCashPortion) {
          throw new BadRequestException('El efectivo recibido no cubre el total de la orden');
        }
        change = Math.max(0, cashReceived - expectedCashPortion);
      } else {
        normalizedPaymentDetails[dto.paymentMethod] = orderTotal;
      }

      const invoice = manager.create(Invoice, {
        orderId: dto.orderId,
        invoiceNumber,
        paymentMethod: dto.paymentMethod,
        paymentDetails: Object.keys(normalizedPaymentDetails).length > 0 ? normalizedPaymentDetails : undefined,
        customerName: dto.customerName || order.customer?.name || 'Consumidor final',
        customerTaxId: dto.customerTaxId || order.customer?.taxId || undefined,
        customerAddress: dto.customerAddress || order.customer?.address || undefined,
        subtotal: orderSubtotal,
        taxAmount: orderTaxAmount,
        tipAmount: order.tipAmount,
        discountAmount: order.discountAmount + pointsDiscount,
        total: orderTotal,
        cashReceived,
        change,
      });

      const saved = await manager.save(Invoice, invoice);

      // Actualizar orden con puntos usados
      if (pointsUsed > 0) {
        await manager.update(Order, dto.orderId, {
          pointsUsed,
          pointsDiscount,
        });
      }

      // Calcular y acumular puntos ganados basado en los items
      if (order.customerId && order.items && order.items.length > 0) {
        let pointsEarned = 0;
        for (const item of order.items) {
          const product = await manager.findOne(Product, { where: { id: item.productId } });
          if (product) {
            pointsEarned += (product.pointsPerPurchase || 0) * Number(item.quantity || 0);
          }
        }
        if (pointsEarned > 0) {
          await manager.increment(Customer, { id: order.customerId }, 'loyaltyPoints', pointsEarned);
          await manager.save('loyalty_transactions', {
            customerId: order.customerId,
            points: pointsEarned,
            description: `Puntos ganados por compra - Factura ${invoiceNumber}`,
            relatedOrderId: dto.orderId,
          });
        }
      }

      // Cerrar la orden
      await manager.update(Order, dto.orderId, {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
      });

      await this.auditService.log({
        branchId: order.branchId,
        userId,
        action: 'invoice.create',
        entity: 'Invoice',
        entityId: saved.id,
        newValue: { invoiceNumber, total: order.total, paymentMethod: dto.paymentMethod },
      });

      const printableItems = (order.items || []).map((item) => {
        const lineSubtotal = Number(item.subtotal || 0);
        const explicitTaxRate = item.taxRate == null ? null : Number(item.taxRate);
        const effectiveTaxRate = explicitTaxRate == null
          ? (orderSubtotal > 0 ? (orderTaxAmount / orderSubtotal) * 100 : 0)
          : explicitTaxRate;
        const lineTaxAmount = lineSubtotal * (effectiveTaxRate / 100);

        return {
          productName: item.productName,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          subtotal: lineSubtotal,
          taxRate: effectiveTaxRate,
          taxAmount: lineTaxAmount,
          total: lineSubtotal + lineTaxAmount,
          notes: item.notes,
          unitOfMeasure: item.unitOfMeasure,
          cabysCode: item.cabysCode,
        };
      });

      // Enviar comprobante electrónico a Hacienda de forma asíncrona
      // (no bloquea la respuesta al cajero si Hacienda tarda o falla)
      setImmediate(() => {
        this.haciendaService
          .sendInvoice(saved.id)
          .catch((e) => this.logger.error(`Error enviando factura ${saved.id} a Hacienda: ${e.message}`));
      });

      return {
        ...saved,
        printable: {
          issuer: {
            name: order.branch?.name,
            taxIdType: config?.haciendaTaxIdType,
            taxId: config?.haciendaTaxId,
            address: order.branch?.address,
            phone: order.branch?.phone,
            email: order.branch?.email,
            province: config?.haciendaProvince,
            canton: config?.haciendaCanton,
            district: config?.haciendaDistrict,
          },
          invoice: {
            invoiceNumber: saved.invoiceNumber,
            issuedAt: saved.createdAt,
            paymentMethod: saved.paymentMethod,
            haciendaKey: saved.haciendaKey,
            haciendaConsecutive: saved.haciendaConsecutive,
          },
          order: {
            orderNumber: order.orderNumber,
            type: order.type,
            table: order.table?.number ? `Mesa ${order.table.number}` : null,
            notes: order.notes,
            customer: order.customer ? {
              name: order.customer.name,
              code: order.customer.code,
              email: order.customer.email,
              loyaltyPoints: order.customer.loyaltyPoints,
            } : null,
          },
          items: printableItems,
          totals: {
            subtotal: orderSubtotal,
            taxAmount: orderTaxAmount,
            tipAmount: Number(order.tipAmount || 0),
            discountAmount: Number(order.discountAmount || 0) + pointsDiscount,
            pointsUsed,
            pointsDiscount,
            total: orderTotal,
            cashReceived,
            change,
          },
        },
      };
    });
  }

  async cancelInvoice(id: string, reason: string, userId?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, status: InvoiceStatus.ISSUED },
      relations: ['order'],
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada o ya anulada');

    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.CANCELLED,
      cancellationReason: reason,
      cancelledByUserId: userId,
      cancelledAt: new Date(),
    });

    await this.auditService.log({
      branchId: invoice.order?.branchId,
      userId,
      action: 'invoice.cancel',
      entity: 'Invoice',
      entityId: id,
      newValue: { reason },
    });

    return this.invoiceRepository.findOneOrFail({ where: { id } });
  }

  async createCreditNote(id: string, reason: string, userId?: string): Promise<Invoice> {
    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      throw new BadRequestException('El motivo de la nota de credito es obligatorio');
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id, status: InvoiceStatus.ISSUED },
      relations: ['order'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada o no elegible para nota de credito');
    }

    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.CREDIT_NOTE,
      cancellationReason: `NC: ${trimmedReason}`,
      cancelledByUserId: userId,
      cancelledAt: new Date(),
      haciendaDocType: 'NC',
      haciendaStatus: invoice.haciendaStatus === 'accepted' ? 'pending' : invoice.haciendaStatus,
      haciendaMessage: invoice.haciendaStatus === 'accepted'
        ? 'Nota de credito administrativa creada. Pendiente implementacion de envio fiscal NC.'
        : (invoice.haciendaMessage ?? undefined),
    });

    await this.auditService.log({
      branchId: invoice.order?.branchId,
      userId,
      action: 'invoice.credit_note',
      entity: 'Invoice',
      entityId: id,
      newValue: { reason: trimmedReason },
    });

    return this.invoiceRepository.findOneOrFail({ where: { id } });
  }

  findAll(branchId: string, from?: Date, to?: Date): Promise<Invoice[]> {
    const query = this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.order', 'order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.branch', 'branch')
      .where('order.branchId = :branchId', { branchId })
      .orderBy('inv.createdAt', 'DESC');

    if (from) {
      // Start of day: 00:00:00
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      query.andWhere('inv.createdAt >= :from', { from: fromDate });
    }
    
    if (to) {
      // End of day: 23:59:59.999 (next day at 00:00:00)
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      toDate.setHours(0, 0, 0, 0);
      query.andWhere('inv.createdAt < :to', { to: toDate });
    }

    return query.getMany();
  }

  async sendInvoiceByEmail(invoiceId: string, toEmail: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = String(toEmail || '').trim();
    if (!cleanEmail) {
      throw new BadRequestException('Debes indicar un correo destino');
    }
    if (!process.env.SMTP_HOST) {
      throw new BadRequestException('SMTP no configurado. Define SMTP_HOST para habilitar envio de facturas');
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'order.items', 'order.branch', 'order.customer', 'order.table'],
    });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    const pdfBuffer = await this.generateInvoicePdf(invoice);
    const smtpPass = String(process.env.SMTP_PASS ?? '').replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: smtpPass },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: cleanEmail,
      subject: `Factura ${invoice.invoiceNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="margin:0 0 8px;color:#111827">Factura ${invoice.invoiceNumber}</h2>
          <p style="margin:0 0 8px;color:#374151">Adjuntamos su factura en formato carta (PDF).</p>
          <p style="margin:0;color:#6b7280">Total: <strong>${Number(invoice.total || 0).toFixed(2)}</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `factura-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return { success: true, message: 'Factura enviada por correo correctamente' };
  }

  private generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const order = invoice.order;
      const branch = order?.branch;
      const customer = order?.customer;
      const created = new Date(invoice.createdAt).toLocaleString('es-CR');

      doc.fontSize(18).text(branch?.name || 'Factura', { align: 'left' });
      doc.moveDown(0.25);
      doc.fontSize(10).text(`Factura: ${invoice.invoiceNumber}`);
      doc.text(`Fecha: ${created}`);
      doc.text(`Metodo de pago: ${invoice.paymentMethod}`);
      doc.text(`Cliente: ${invoice.customerName || customer?.name || 'Consumidor final'}`);
      doc.moveDown(0.5);
      doc.text(`Sucursal: ${branch?.address || 'Direccion no registrada'}`);
      if (branch?.phone) doc.text(`Telefono: ${branch.phone}`);
      if (branch?.email) doc.text(`Email: ${branch.email}`);

      doc.moveDown(1);
      doc.fontSize(11).text('Detalle');
      doc.moveDown(0.25);

      const items = order?.items || [];
      items.forEach((item) => {
        const qty = Number(item.quantity || 0);
        const sub = Number(item.subtotal || 0);
        doc.fontSize(10).text(`${qty} x ${item.productName}`, { continued: true }).text(`  ${sub.toFixed(2)}`, { align: 'right' });
      });

      doc.moveDown(1);
      doc.fontSize(10).text(`Subtotal: ${Number(invoice.subtotal || 0).toFixed(2)}`, { align: 'right' });
      doc.text(`Impuestos: ${Number(invoice.taxAmount || 0).toFixed(2)}`, { align: 'right' });
      doc.text(`Propina: ${Number(invoice.tipAmount || 0).toFixed(2)}`, { align: 'right' });
      doc.text(`Descuento: ${Number(invoice.discountAmount || 0).toFixed(2)}`, { align: 'right' });
      doc.fontSize(12).text(`TOTAL: ${Number(invoice.total || 0).toFixed(2)}`, { align: 'right' });

      if (Number(invoice.cashReceived || 0) > 0) {
        doc.moveDown(0.25);
        doc.fontSize(10).text(`Efectivo recibido: ${Number(invoice.cashReceived || 0).toFixed(2)}`, { align: 'right' });
        doc.text(`Cambio: ${Number(invoice.change || 0).toFixed(2)}`, { align: 'right' });
      }

      doc.end();
    });
  }
}
