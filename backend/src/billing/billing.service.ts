import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentMethod } from './entities/invoice.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto } from './dto/billing.dto';
import { HaciendaService } from '../hacienda/hacienda.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly haciendaService: HaciendaService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId?: string): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        relations: ['branch', 'items', 'table'],
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

      const orderTotal = Number(order.total || 0);
      const orderTaxAmount = Number(order.taxAmount || 0);
      const orderSubtotal = Number(order.subtotal || 0);
      const cashReceived = Number(dto.cashReceived || orderTotal);
      const change = Math.max(0, cashReceived - orderTotal);

      const invoice = manager.create(Invoice, {
        orderId: dto.orderId,
        invoiceNumber,
        paymentMethod: dto.paymentMethod,
        paymentDetails: dto.paymentDetails,
        customerName: dto.customerName,
        customerTaxId: dto.customerTaxId,
        customerAddress: dto.customerAddress,
        subtotal: orderSubtotal,
        taxAmount: orderTaxAmount,
        tipAmount: order.tipAmount,
        discountAmount: order.discountAmount,
        total: orderTotal,
        cashReceived,
        change,
      });

      const saved = await manager.save(Invoice, invoice);

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
          },
          items: printableItems,
          totals: {
            subtotal: orderSubtotal,
            taxAmount: orderTaxAmount,
            tipAmount: Number(order.tipAmount || 0),
            discountAmount: Number(order.discountAmount || 0),
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

  findAll(branchId: string, from?: Date, to?: Date): Promise<Invoice[]> {
    const query = this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoin('inv.order', 'order')
      .where('order.branchId = :branchId', { branchId })
      .orderBy('inv.createdAt', 'DESC');

    if (from) query.andWhere('inv.createdAt >= :from', { from });
    if (to) query.andWhere('inv.createdAt <= :to', { to });

    return query.getMany();
  }
}
