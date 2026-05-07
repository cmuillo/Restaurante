import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly gateway: RestaurantGateway,
    private readonly auditService: AuditService,
  ) {}

  private startOfDay(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private async findKitchenOrder(id: string, branchId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, branchId },
      relations: ['items', 'items.modifiers', 'table', 'customer'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  /** Órdenes activas y listas del día para el KDS */
  getPendingOrders(branchId: string): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.modifiers', 'modifiers')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.createdAt >= :startOfDay', { startOfDay: this.startOfDay() })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .orderBy('order.createdAt', 'ASC')
      .getMany();
  }

  async startPreparation(id: string, branchId: string, userId?: string): Promise<Order> {
    const order = await this.findKitchenOrder(id, branchId);

    if (order.readyAt) {
      throw new BadRequestException('La orden ya fue marcada como lista');
    }

    if (order.preparationStartedAt) {
      return order;
    }

    const preparationStartedAt = new Date();
    await this.orderRepository.update(id, { preparationStartedAt });

    this.gateway.emitOrderStatusUpdate(branchId, {
      id,
      kitchenState: 'in_preparation',
      preparationStartedAt,
    });

    await this.auditService.log({
      branchId,
      userId,
      action: 'kitchen.preparation_started',
      entity: 'Order',
      entityId: id,
      oldValue: { preparationStartedAt: order.preparationStartedAt },
      newValue: { preparationStartedAt },
    });

    return this.findKitchenOrder(id, branchId);
  }

  async markReady(id: string, branchId: string, userId?: string): Promise<Order> {
    const order = await this.findKitchenOrder(id, branchId);

    if (order.readyAt) {
      return order;
    }

    const now = new Date();
    await this.orderRepository.update(id, {
      preparationStartedAt: order.preparationStartedAt ?? now,
      readyAt: now,
    });

    this.gateway.emitOrderReady(branchId, { id, orderNumber: order.orderNumber, readyAt: now });
    this.gateway.emitOrderStatusUpdate(branchId, { id, kitchenState: 'ready', readyAt: now });

    await this.auditService.log({
      branchId,
      userId,
      action: 'kitchen.ready',
      entity: 'Order',
      entityId: id,
      oldValue: { readyAt: order.readyAt },
      newValue: { readyAt: now },
    });

    return this.findKitchenOrder(id, branchId);
  }

  async markPrinted(id: string, branchId: string, userId?: string): Promise<Order> {
    const order = await this.findKitchenOrder(id, branchId);
    const kitchenPrintedAt = new Date();

    await this.orderRepository.update(id, { kitchenPrintedAt });
    this.gateway.emitOrderStatusUpdate(branchId, { id, kitchenPrintedAt });

    await this.auditService.log({
      branchId,
      userId,
      action: 'kitchen.ticket_printed',
      entity: 'Order',
      entityId: id,
      oldValue: { kitchenPrintedAt: order.kitchenPrintedAt },
      newValue: { kitchenPrintedAt },
    });

    return this.findKitchenOrder(id, branchId);
  }

  /** Tiempo promedio de preparación de los últimos 7 días */
  async getAvgPrepTime(branchId: string): Promise<number> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select("AVG(EXTRACT(EPOCH FROM (order.readyAt - COALESCE(order.preparationStartedAt, order.createdAt))) / 60)", 'avgMinutes')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.readyAt IS NOT NULL')
      .andWhere("order.createdAt > NOW() - INTERVAL '7 days'")
      .getRawOne();

    return parseFloat(result?.avgMinutes || '0');
  }
}
