import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
  ) {}

  /** Órdenes pendientes y en preparación para el KDS */
  getPendingOrders(branchId: string): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.modifiers', 'modifiers')
      .leftJoinAndSelect('order.table', 'table')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.PENDING, OrderStatus.IN_PREPARATION],
      })
      .orderBy('order.createdAt', 'ASC') // FIFO — primero en llegar, primero en servir
      .getMany();
  }

  /** Tiempo promedio de preparación de los últimos 7 días */
  async getAvgPrepTime(branchId: string): Promise<number> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select("AVG(EXTRACT(EPOCH FROM (order.readyAt - order.createdAt)) / 60)", 'avgMinutes')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.readyAt IS NOT NULL')
      .andWhere("order.createdAt > NOW() - INTERVAL '7 days'")
      .getRawOne();

    return parseFloat(result?.avgMinutes || '0');
  }
}
