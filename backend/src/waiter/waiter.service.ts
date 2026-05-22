import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { Category } from '../menu/entities/category.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Table } from '../tables/entities/table.entity';
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { OrdersService } from '../orders/orders.service';
import { TablesService } from '../tables/tables.service';
import { TableStatus } from '../tables/entities/table.entity';

@Injectable()
export class WaiterService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(BranchConfig) private readonly configRepo: Repository<BranchConfig>,
    @InjectRepository(Table) private readonly tableRepo: Repository<Table>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
    private readonly tablesService: TablesService,
  ) {}

  /** Menú completo de la sucursal (todos los productos activos, sin filtro showInKiosk). */
  async getMenu(branchId: string) {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, isActive: true } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada o inactiva');

    const config = await this.configRepo.findOne({ where: { branchId } });

    const categories = await this.categoryRepo
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.products', 'product', 'product.isActive = true')
      .leftJoinAndSelect('product.modifiers', 'modifier')
      .leftJoinAndSelect('modifier.options', 'option', 'option.isActive = true')
      .where('cat.branchId = :branchId', { branchId })
      .andWhere('cat.isActive = true')
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('product.sortOrder', 'ASC')
      .getMany();

    const products = categories.flatMap((cat) =>
      (cat.products ?? []).map((p) => ({ ...p, categoryId: cat.id })),
    );

    return {
      branch: { id: branch.id, name: branch.name },
      branchConfig: {
        currency: config?.currency ?? 'CRC',
        taxPercentage: config?.taxPercentage ?? 13,
        tipPercentage: config?.tipPercentage ?? 0,
      },
      categories: categories.map(({ products: _p, ...cat }) => cat),
      products,
    };
  }

  /** Mesas activas de la sucursal con estado. */
  getTables(branchId: string) {
    return this.tablesService.findAll(branchId);
  }

  /** Orden activa de la mesa (PENDING, IN_PREPARATION, READY o DELIVERED). */
  async getActiveOrder(tableId: string, branchId: string) {
    const order = await this.orderRepo.findOne({
      where: {
        tableId,
        branchId,
        type: OrderType.DINE_IN,
        status: In([
          OrderStatus.PENDING,
          OrderStatus.IN_PREPARATION,
          OrderStatus.READY,
          OrderStatus.DELIVERED,
        ]),
      },
      relations: ['items', 'items.modifiers'],
      order: { createdAt: 'DESC' },
    });
    return order ?? null;
  }

  /** Crear nueva orden (userId viene del JWT). */
  createOrder(dto: CreateOrderDto, userId: string) {
    return this.ordersService.create(dto, userId);
  }

  /** Agregar ítems a orden existente. */
  addItemsToOrder(orderId: string, branchId: string, dto: AddOrderItemsDto, userId: string) {
    return this.ordersService.addItemsToOrder(orderId, branchId, dto.items, userId);
  }

  /** Solicitar cuenta: cambia estado de la mesa a bill_requested. */
  requestBill(tableId: string, branchId: string, waiterId: string) {
    return this.tablesService.updateStatus(tableId, branchId, TableStatus.BILL_REQUESTED, waiterId);
  }

  /** Liberar mesa manualmente (PAID → FREE). */
  releaseTable(tableId: string, branchId: string, waiterId: string) {
    return this.tablesService.updateStatus(tableId, branchId, TableStatus.FREE, waiterId);
  }

  /** Estadísticas en tiempo real de la cocina (para meseros). */
  async getKitchenStats(branchId: string): Promise<{
    inQueue: number;
    inPreparation: number;
    avgPrepMinutes: number;
    avgCycleMinutes: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [inQueue, inPreparation, prepResult, cycleResult] = await Promise.all([
      this.orderRepo.count({
        where: { branchId, status: OrderStatus.PENDING, createdAt: MoreThanOrEqual(startOfDay) },
      }),
      this.orderRepo.count({
        where: { branchId, status: OrderStatus.IN_PREPARATION },
      }),
      this.orderRepo
        .createQueryBuilder('o')
        .select("AVG(EXTRACT(EPOCH FROM (o.readyAt - COALESCE(o.preparationStartedAt, o.createdAt))) / 60)", 'avg')
        .where('o.branchId = :branchId', { branchId })
        .andWhere('o.readyAt IS NOT NULL')
        .andWhere("o.createdAt > NOW() - INTERVAL '7 days'")
        .getRawOne(),
      this.orderRepo
        .createQueryBuilder('o')
        .select("AVG(EXTRACT(EPOCH FROM (o.readyAt - o.createdAt)) / 60)", 'avg')
        .where('o.branchId = :branchId', { branchId })
        .andWhere('o.readyAt IS NOT NULL')
        .andWhere('o.createdAt >= :startOfDay', { startOfDay })
        .getRawOne(),
    ]);

    return {
      inQueue,
      inPreparation,
      avgPrepMinutes: Math.round(parseFloat(prepResult?.avg || '0') * 10) / 10,
      avgCycleMinutes: Math.round(parseFloat(cycleResult?.avg || '0') * 10) / 10,
    };
  }
}
