import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>,
  ) {}

  create(branchId: string, dto: CreateExpenseDto, userId?: string): Promise<Expense> {
    const expense = this.expenseRepository.create({ ...dto, branchId, userId });
    return this.expenseRepository.save(expense);
  }

  findAll(branchId: string, from?: Date, to?: Date): Promise<Expense[]> {
    const query = this.expenseRepository
      .createQueryBuilder('exp')
      .where('exp.branchId = :branchId', { branchId })
      .orderBy('exp.date', 'DESC');
    if (from) query.andWhere('exp.date >= :from', { from });
    if (to) query.andWhere('exp.date <= :to', { to });
    return query.getMany();
  }

  getSummaryByCategory(branchId: string, from: Date, to: Date) {
    return this.expenseRepository
      .createQueryBuilder('exp')
      .select(['exp.category AS category', 'SUM(exp.amount) AS total'])
      .where('exp.branchId = :branchId', { branchId })
      .andWhere('exp.date BETWEEN :from AND :to', { from, to })
      .groupBy('exp.category')
      .orderBy('total', 'DESC')
      .getRawMany();
  }
}
