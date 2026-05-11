import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpenseInboxItem } from './entities/expense-inbox-item.entity';
import { ExpenseEmailConfig } from './entities/expense-email-config.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, ExpenseInboxItem, ExpenseEmailConfig])],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
