import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Product } from '../menu/entities/product.entity';
import { ModifierOption } from '../menu/entities/modifier-option.entity';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { AuditService } from '../audit/audit.service';
import { Table, TableStatus } from '../tables/entities/table.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepository: Repository<OrderItem>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(ModifierOption) private readonly modifierOptionRepository: Repository<ModifierOption>,
    private readonly dataSource: DataSource,
    private readonly gateway: RestaurantGateway,
    private readonly auditService: AuditService,
  ) {}

  private async syncTableStatusForOrder(
    manager: any,
    order: Pick<Order, 'id' | 'branchId' | 'tableId' | 'type'>,
    nextStatus: OrderStatus,
  ): Promise<TableStatus | null> {
    if (!order.tableId || order.type !== OrderType.DINE_IN) return null;

    if (
      nextStatus === OrderStatus.PENDING
      || nextStatus === OrderStatus.IN_PREPARATION
    ) {
      await manager.update(Table, { id: order.tableId, branchId: order.branchId }, { status: TableStatus.WAITING_FOOD });
      return TableStatus.WAITING_FOOD;
    }

    if (nextStatus === OrderStatus.READY || nextStatus === OrderStatus.DELIVERED) {
      await manager.update(Table, { id: order.tableId, branchId: order.branchId }, { status: TableStatus.OCCUPIED });
      return TableStatus.OCCUPIED;
    }

    if (nextStatus === OrderStatus.CANCELLED || nextStatus === OrderStatus.COMPLETED) {
      const activeOrders = await manager.count(Order, {
        where: {
          branchId: order.branchId,
          tableId: order.tableId,
          type: OrderType.DINE_IN,
          status: In([
            OrderStatus.PENDING,
            OrderStatus.IN_PREPARATION,
            OrderStatus.READY,
            OrderStatus.DELIVERED,
          ]),
        },
      });

      if (activeOrders === 0) {
        await manager.update(Table, { id: order.tableId, branchId: order.branchId }, { status: TableStatus.FREE });
        return TableStatus.FREE;
      }
    }

    return null;
  }

  /**
   * Carga las opciones de modificador desde la BD indexadas por id.
   * Los precios/nombres se toman SIEMPRE de la BD (fuente de verdad),
   * nunca de lo que envía el cliente, para evitar manipulación de precios.
   */
  private async loadModifierOptions(
    items: Array<{ modifiers?: Array<{ modifierOptionId: string }> }>,
  ): Promise<Map<string, ModifierOption>> {
    const optionIds = [
      ...new Set(
        items.flatMap((item) => (item.modifiers ?? []).map((m) => m.modifierOptionId)),
      ),
    ];
    if (optionIds.length === 0) return new Map();
    const options = await this.modifierOptionRepository.findBy({ id: In(optionIds) });
    return new Map(options.map((o) => [o.id, o]));
  }

  async create(dto: CreateOrderDto, userId?: string): Promise<Order> {
    const created = await this.dataSource.transaction(async (manager) => {
      // Calcular totales
      let subtotal = 0;
      let taxAmount = 0;

      const uniqueProductIds = [...new Set(dto.items.map((item) => item.productId))];
      const products = uniqueProductIds.length > 0
        ? await this.productRepository.findBy({ id: In(uniqueProductIds) })
        : [];
      const productsById = new Map(products.map((p) => [p.id, p]));
      const optionsById = await this.loadModifierOptions(dto.items);

      const itemsData: Partial<OrderItem>[] = dto.items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new BadRequestException(`Producto no encontrado para item ${item.productId}`);
        }

        // El precio unitario proviene de la BD, no del cliente (anti-manipulación)
        const unitPrice = Number(product.price);
        let itemTotal = unitPrice * item.quantity;
        const modifiers: Partial<OrderItemModifier>[] = (item.modifiers || []).map((mod) => {
          const option = optionsById.get(mod.modifierOptionId);
          if (!option) {
            throw new BadRequestException(`Modificador no encontrado: ${mod.modifierOptionId}`);
          }
          const extraPrice = Number(option.extraPrice);
          itemTotal += extraPrice * item.quantity;
          return {
            modifierOptionId: option.id,
            optionName: option.name,
            extraPrice,
          };
        });

        const lineTaxRate = product.taxRate == null ? dto.taxPercentage : Number(product.taxRate);
        const lineTaxAmount = itemTotal * (lineTaxRate / 100);

        subtotal += itemTotal;
        taxAmount += lineTaxAmount;

        return {
          productId: item.productId,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          subtotal: itemTotal,
          notes: item.notes,
          cabysCode: product.cabysCode,
          commercialCodeType: product.commercialCodeType,
          commercialCode: product.commercialCode,
          taxCode: product.taxCode,
          taxRate: lineTaxRate,
          unitOfMeasure: product.unitOfMeasure,
          isBar: product.isBar ?? false,
          modifiers: modifiers as OrderItemModifier[],
        };
      });

      const effectiveTaxPercentage = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
      const tipAmount = subtotal * ((dto.tipPercentage ?? 0) / 100);
      const total = subtotal + taxAmount - (dto.discountAmount || 0);

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
        taxPercentage: effectiveTaxPercentage,
        taxAmount,
        tipPercentage: dto.tipPercentage || 0,
        tipAmount,
        discountAmount: dto.discountAmount || 0,
        total,
        items: itemsData as OrderItem[],
      });

      const saved = await manager.save(Order, order);
      const tableStatus = await this.syncTableStatusForOrder(manager, saved, OrderStatus.PENDING);

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

      return { saved, tableStatus };
    });

    if (created.tableStatus && created.saved.tableId) {
      this.gateway.emitTableUpdated(created.saved.branchId, {
        id: created.saved.tableId,
        status: created.tableStatus,
      });
    }

    return created.saved;
  }

  async findAll(branchId: string, filters?: { status?: OrderStatus; type?: OrderType }) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.modifiers', 'modifiers')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.branchId = :branchId', { branchId });

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }
    if (filters?.type) {
      query.andWhere('order.type = :type', { type: filters.type });
    }

    const orders = await query.orderBy('order.createdAt', 'DESC').getMany();

    // Inyectar factura en órdenes que forman parte de una factura combinada de mesa
    // pero no son la orden primaria (no tienen FK directa en invoice.orderId)
    const ordersWithoutInvoice = orders.filter((o) => !o.invoice);
    if (ordersWithoutInvoice.length > 0) {
      const tableInvoices = await this.dataSource
        .getRepository(Invoice)
        .createQueryBuilder('inv')
        .innerJoin('inv.order', 'primaryOrder')
        .where('primaryOrder.branchId = :branchId', { branchId })
        .andWhere('inv.orderIds IS NOT NULL')
        .select(['inv.id', 'inv.orderId', 'inv.orderIds', 'inv.invoiceNumber', 'inv.status', 'inv.paymentMethod', 'inv.total', 'inv.createdAt'])
        .getMany();

      if (tableInvoices.length > 0) {
        const orderToInvoice = new Map<string, Invoice>();
        for (const inv of tableInvoices) {
          for (const oid of (inv.orderIds ?? [])) {
            if (oid !== inv.orderId) {
              orderToInvoice.set(oid, inv);
            }
          }
        }
        for (const order of ordersWithoutInvoice) {
          const inv = orderToInvoice.get(order.id);
          if (inv) {
            order.invoice = inv;
          }
        }
      }
    }

    return orders;
  }

  async findOne(id: string, branchId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, branchId },
      relations: ['items', 'items.modifiers', 'table', 'user', 'customer', 'invoice'],
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

    const result = await this.dataSource.transaction(async (manager) => {
      const updates: Partial<Order> = { status: dto.status };
      if (dto.status === OrderStatus.READY) updates.readyAt = new Date();
      if (dto.status === OrderStatus.COMPLETED) updates.completedAt = new Date();
      if (dto.status === OrderStatus.IN_PREPARATION) updates.preparationStartedAt = new Date();

      await manager.update(Order, id, updates as any);
      const tableStatus = await this.syncTableStatusForOrder(manager, order, dto.status);
      const updated = await manager.findOneOrFail(Order, {
        where: { id, branchId },
        relations: ['items', 'items.modifiers', 'table', 'user', 'customer', 'invoice'],
      });
      return { updated, tableStatus };
    });

    if (result.tableStatus && order.tableId) {
      this.gateway.emitTableUpdated(branchId, { id: order.tableId, status: result.tableStatus });
    }

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

    return result.updated;
  }

  async cancel(id: string, branchId: string, reason: string, userId?: string): Promise<Order> {
    return this.updateStatus(
      id,
      branchId,
      { status: OrderStatus.CANCELLED, reason },
      userId,
    );
  }

  async addItemsToOrder(
    orderId: string,
    branchId: string,
    items: CreateOrderItemDto[],
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId, branchId);

    const notAddable: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.COMPLETED];
    if (notAddable.includes(order.status)) {
      throw new BadRequestException(
        `No se pueden agregar ítems a una orden en estado ${order.status}`,
      );
    }

    const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.productRepository.findBy({ id: In(uniqueProductIds) });
    const productsById = new Map(products.map((p) => [p.id, p]));
    const optionsById = await this.loadModifierOptions(items);

    await this.dataSource.transaction(async (manager) => {
      const newItems: Partial<OrderItem>[] = items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new BadRequestException(`Producto no encontrado: ${item.productId}`);

        const lineTaxRate = product.taxRate == null ? order.taxPercentage : Number(product.taxRate);
        const modifiers: Partial<OrderItemModifier>[] = (item.modifiers ?? []).map((m) => {
          const option = optionsById.get(m.modifierOptionId);
          if (!option) throw new BadRequestException(`Modificador no encontrado: ${m.modifierOptionId}`);
          return {
            modifierOptionId: option.id,
            optionName: option.name,
            extraPrice: Number(option.extraPrice),
          };
        });

        // El precio unitario proviene de la BD, no del cliente (anti-manipulación)
        const unitPrice = Number(product.price);
        let lineTotal = unitPrice * item.quantity;
        for (const mod of modifiers) {
          lineTotal += Number(mod.extraPrice) * item.quantity;
        }

        return {
          orderId: order.id,
          productId: item.productId,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          subtotal: lineTotal,
          notes: item.notes,
          cabysCode: product.cabysCode,
          commercialCodeType: product.commercialCodeType,
          commercialCode: product.commercialCode,
          taxCode: product.taxCode,
          taxRate: lineTaxRate,
          unitOfMeasure: product.unitOfMeasure,
          isBar: product.isBar ?? false,
          modifiers: modifiers as OrderItemModifier[],
        };
      });

      await manager.save(OrderItem, newItems as OrderItem[]);

      // Recalcular totales de la orden
      const allItems = await manager.find(OrderItem, {
        where: { orderId: order.id },
        relations: ['modifiers'],
      });

      let subtotal = 0;
      let taxAmount = 0;
      for (const it of allItems) {
        const lineSubtotal = Number(it.unitPrice) * it.quantity
          + (it.modifiers ?? []).reduce((s, m) => s + Number(m.extraPrice) * it.quantity, 0);
        const lineTax = lineSubtotal * (Number(it.taxRate) / 100);
        subtotal += lineSubtotal;
        taxAmount += lineTax;
      }

      const effectiveTaxPct = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
      const tipAmt = subtotal * (Number(order.tipPercentage) / 100);
      // La propina es seguimiento interno y NO se suma al total a cobrar
      // (consistente con create() y BillingService).
      const total = subtotal + taxAmount - Number(order.discountAmount);

      await manager.update(Order, { id: order.id }, {
        subtotal,
        taxPercentage: effectiveTaxPct,
        taxAmount,
        tipAmount: tipAmt,
        total,
      });
    });

    const updated = await this.findOne(orderId, branchId);

    this.gateway.emitNewOrder(branchId, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      type: updated.type,
      tableId: updated.tableId,
      items: items,
      createdAt: updated.createdAt,
    });

    await this.auditService.log({
      branchId,
      userId,
      action: 'order.addItems',
      entity: 'Order',
      entityId: order.id,
      newValue: { itemsAdded: items.length },
    });

    return updated;
  }
}
