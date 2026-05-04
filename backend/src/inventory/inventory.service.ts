import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem, InventoryUnit } from './entities/inventory-item.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { CreateInventoryItemDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private readonly itemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction) private readonly txRepository: Repository<InventoryTransaction>,
    private readonly dataSource: DataSource,
    private readonly gateway: RestaurantGateway,
  ) {}

  findAll(branchId: string): Promise<InventoryItem[]> {
    return this.itemRepository.find({ where: { branchId, isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string, branchId: string): Promise<InventoryItem> {
    const item = await this.itemRepository.findOne({ where: { id, branchId } });
    if (!item) throw new NotFoundException('Ítem de inventario no encontrado');
    return item;
  }

  async create(branchId: string, dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const item = this.itemRepository.create({
      branchId,
      name: dto.name,
      unit: dto.unit as unknown as InventoryUnit,
      currentStock: dto.currentStock ?? 0,
      minStock: (dto as any).minimumStock ?? 0,
      costPerUnit: dto.costPerUnit ?? 0,
    });
    return this.itemRepository.save(item);
  }

  async update(id: string, branchId: string, dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.itemRepository.findOne({ where: { id, branchId } });
    if (!item) throw new NotFoundException('Ítem de inventario no encontrado');

    await this.itemRepository.update(id, {
      name: dto.name,
      unit: dto.unit as unknown as InventoryUnit,
      currentStock: dto.currentStock ?? item.currentStock,
      minStock: (dto as any).minimumStock ?? item.minStock,
      costPerUnit: dto.costPerUnit ?? item.costPerUnit,
    } as any);

    return this.itemRepository.findOneOrFail({ where: { id, branchId } });
  }

  async adjustStock(
    id: string,
    branchId: string,
    quantity: number,
    type: TransactionType,
    reason: string,
    userId?: string,
    orderId?: string,
  ): Promise<InventoryItem> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(InventoryItem, { where: { id, branchId } });
      if (!item) throw new NotFoundException('Ítem no encontrado');

      const delta = type === TransactionType.IN ? quantity : -quantity;
      const newStock = Number(item.currentStock) + delta;

      await manager.update(InventoryItem, id, { currentStock: newStock });

      await manager.save(InventoryTransaction, {
        inventoryItemId: id,
        type,
        quantity,
        stockAfter: newStock,
        reason,
        relatedOrderId: orderId,
        userId,
      });

      // Alerta de stock bajo
      if (newStock <= item.minStock) {
        this.gateway.emitLowStockAlert(branchId, {
          id: item.id,
          name: item.name,
          currentStock: newStock,
          minStock: item.minStock,
          unit: item.unit,
        });
      }

      return { ...item, currentStock: newStock } as InventoryItem;
    });
  }

  getTransactions(itemId: string): Promise<InventoryTransaction[]> {
    return this.txRepository.find({
      where: { inventoryItemId: itemId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  getLowStockItems(branchId: string): Promise<InventoryItem[]> {
    return this.itemRepository
      .createQueryBuilder('item')
      .where('item.branchId = :branchId', { branchId })
      .andWhere('item.isActive = true')
      .andWhere('item.currentStock <= item.minStock')
      .orderBy('item.name', 'ASC')
      .getMany();
  }
}
