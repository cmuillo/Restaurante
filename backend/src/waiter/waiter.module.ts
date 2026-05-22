import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaiterController } from './waiter.controller';
import { WaiterService } from './waiter.service';
import { Category } from '../menu/entities/category.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Table } from '../tables/entities/table.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Branch, BranchConfig, Table, Order]),
    OrdersModule,
    TablesModule,
  ],
  controllers: [WaiterController],
  providers: [WaiterService],
})
export class WaiterModule {}
