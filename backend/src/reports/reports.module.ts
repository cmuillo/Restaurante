import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Category } from '../menu/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Invoice, Expense, Category])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
