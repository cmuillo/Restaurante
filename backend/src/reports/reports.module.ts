import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Category } from '../menu/entities/category.entity';
import { PosShift } from '../pos/entities/pos-shift.entity';
import { PosCashMovement } from '../pos/entities/pos-cash-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Invoice, Expense, Category, PosShift, PosCashMovement])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
