import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentMethod } from './entities/invoice.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId?: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        relations: ['branch'],
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

      const cashReceived = dto.cashReceived || order.total;
      const change = Math.max(0, cashReceived - order.total);

      const invoice = manager.create(Invoice, {
        orderId: dto.orderId,
        invoiceNumber,
        paymentMethod: dto.paymentMethod,
        paymentDetails: dto.paymentDetails,
        customerName: dto.customerName,
        customerTaxId: dto.customerTaxId,
        customerAddress: dto.customerAddress,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        tipAmount: order.tipAmount,
        discountAmount: order.discountAmount,
        total: order.total,
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

      return saved;
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
