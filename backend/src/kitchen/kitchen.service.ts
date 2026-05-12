import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Table, TableStatus } from '../tables/entities/table.entity';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
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
      relations: ['items', 'items.modifiers', 'table', 'customer', 'invoice'],
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
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.createdAt >= :startOfDay', { startOfDay: this.startOfDay() })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .orderBy('order.createdAt', 'ASC')
      .getMany();
  }

  async startPreparation(id: string, branchId: string, userId?: string): Promise<Order> {
    const order = await this.findKitchenOrder(id, branchId);

    // Solo bloquear si está cancelada o ya fue marcada lista por cocina
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('La orden está cancelada.');
    }

    if (order.readyAt) {
      throw new BadRequestException('La orden ya fue marcada como lista');
    }

    if (order.preparationStartedAt) {
      return order;
    }

    const preparationStartedAt = new Date();
    // Si la orden ya está COMPLETED (pagó antes de cocinar), no cambiar el status contable
    const newStatus = order.status === OrderStatus.COMPLETED ? OrderStatus.COMPLETED : OrderStatus.IN_PREPARATION;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, { id, branchId }, {
        preparationStartedAt,
        status: newStatus,
      });

      if (order.tableId) {
        await manager.update(Table, { id: order.tableId, branchId }, { status: TableStatus.WAITING_FOOD });
      }
    });

    if (order.tableId) {
      this.gateway.emitTableUpdated(branchId, { id: order.tableId, status: TableStatus.WAITING_FOOD });
    }

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

    // Si la orden ya está lista, no hacer nada
    if (order.readyAt) {
      return order;
    }

    // Si la orden fue pagada antes de ser marcada lista en cocina,
    // solo actualizar readyAt sin tocar el status contable
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED || order.completedAt) {
      const now = new Date();
      await this.dataSource.query(
        `UPDATE "order" SET "readyAt" = NOW(), "preparationStartedAt" = COALESCE("preparationStartedAt", NOW()) WHERE id = $1 AND "branchId" = $2 AND "readyAt" IS NULL`,
        [id, branchId],
      );
      this.gateway.emitOrderReady(branchId, { id, orderNumber: order.orderNumber, readyAt: now });
      this.gateway.emitOrderStatusUpdate(branchId, { id, kitchenState: 'ready', readyAt: now });
      return this.findKitchenOrder(id, branchId);
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, { id, branchId }, {
        status: OrderStatus.READY,
        preparationStartedAt: order.preparationStartedAt ?? now,
        readyAt: now,
      });

      if (order.tableId) {
        await manager.update(Table, { id: order.tableId, branchId }, { status: TableStatus.OCCUPIED });
      }
    });

    if (order.tableId) {
      this.gateway.emitTableUpdated(branchId, { id: order.tableId, status: TableStatus.OCCUPIED });
    }

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
