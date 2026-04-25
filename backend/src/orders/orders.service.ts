import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepository: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly gateway: RestaurantGateway,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOrderDto, userId?: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Calcular totales
      let subtotal = 0;
      const itemsData: Partial<OrderItem>[] = dto.items.map((item) => {
        let itemTotal = item.unitPrice * item.quantity;
        const modifiers: Partial<OrderItemModifier>[] = (item.modifiers || []).map((mod) => {
          itemTotal += mod.extraPrice * item.quantity;
          return {
            modifierOptionId: mod.modifierOptionId,
            optionName: mod.optionName,
            extraPrice: mod.extraPrice,
          };
        });
        subtotal += itemTotal;
        return {
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: itemTotal,
          notes: item.notes,
          modifiers: modifiers as OrderItemModifier[],
        };
      });

      const taxAmount = subtotal * (dto.taxPercentage / 100);
      const tipAmount = subtotal * (dto.tipPercentage / 100);
      const total = subtotal + taxAmount + tipAmount - (dto.discountAmount || 0);

      // Número de orden secuencial por sucursal
      const lastOrder = await manager.findOne(Order, {
        where: { branchId: dto.branchId },
        order: { orderNumber: 'DESC' },
      });
      const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const order = manager.create(Order, {
        branchId: dto.branchId,
        orderNumber,
        type: dto.type,
        tableId: dto.tableId,
        customerId: dto.customerId,
        userId,
        notes: dto.notes,
        subtotal,
        taxPercentage: dto.taxPercentage,
        taxAmount,
        tipPercentage: dto.tipPercentage || 0,
        tipAmount,
        discountAmount: dto.discountAmount || 0,
        total,
        items: itemsData as OrderItem[],
      });

      const saved = await manager.save(Order, order);

      // Emitir a cocina en tiempo real
      this.gateway.emitNewOrder(dto.branchId, {
        id: saved.id,
        orderNumber: saved.orderNumber,
        type: saved.type,
        tableId: saved.tableId,
        items: dto.items,
        createdAt: saved.createdAt,
      });

      await this.auditService.log({
        branchId: dto.branchId,
        userId,
        action: 'order.create',
        entity: 'Order',
        entityId: saved.id,
        newValue: { orderNumber, type: dto.type, total },
      });

      return saved;
    });
  }

  async findAll(branchId: string, filters?: { status?: OrderStatus; type?: OrderType }) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.modifiers', 'modifiers')
      .leftJoinAndSelect('order.table', 'table')
      .where('order.branchId = :branchId', { branchId });

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }
    if (filters?.type) {
      query.andWhere('order.type = :type', { type: filters.type });
    }

    return query.orderBy('order.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, branchId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, branchId },
      relations: ['items', 'items.modifiers', 'table', 'user', 'customer'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async updateStatus(
    id: string,
    branchId: string,
    dto: UpdateOrderStatusDto,
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(id, branchId);
    const oldStatus = order.status;

    // Validar transiciones de estado permitidas
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
      [OrderStatus.IN_PREPARATION]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `No se puede cambiar de ${order.status} a ${dto.status}`,
      );
    }

    const updates: Partial<Order> = { status: dto.status };
    if (dto.status === OrderStatus.READY) updates.readyAt = new Date();
    if (dto.status === OrderStatus.COMPLETED) updates.completedAt = new Date();

    await this.orderRepository.update(id, updates);
    const updated = await this.findOne(id, branchId);

    // Notificar al mesero cuando el pedido está listo
    if (dto.status === OrderStatus.READY) {
      this.gateway.emitOrderReady(branchId, { id, orderNumber: order.orderNumber });
    }

    this.gateway.emitOrderStatusUpdate(branchId, { id, status: dto.status });

    await this.auditService.log({
      branchId,
      userId,
      action: 'order.status_change',
      entity: 'Order',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status: dto.status },
    });

    return updated;
  }

  async cancel(id: string, branchId: string, reason: string, userId?: string): Promise<Order> {
    return this.updateStatus(
      id,
      branchId,
      { status: OrderStatus.CANCELLED, reason },
      userId,
    );
  }
}
