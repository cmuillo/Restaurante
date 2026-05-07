import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, PaymentMethodExpense } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>,
  ) {}

  create(branchId: string, dto: CreateExpenseDto, userId?: string): Promise<Expense> {
    const expense = this.expenseRepository.create({
      category: dto.category as unknown as string,
      description: dto.description,
      amount: dto.amount,
      ivaAmount: dto.ivaAmount ?? 0,
      date: dto.date as unknown as Date,
      supplierName: dto.supplierName,
      supplierTaxId: dto.supplierTaxId,
      receiptNumber: dto.receiptNumber,
      receiptUrl: dto.receiptUrl,
      paymentMethod: (dto.paymentMethod ?? 'transfer') as unknown as PaymentMethodExpense,
      isDeductible: dto.isDeductible ?? false,
      notes: dto.notes,
      branchId,
      userId,
    });
    return this.expenseRepository.save(expense) as Promise<Expense>;
  }

  findAll(branchId: string, from?: Date, to?: Date): Promise<Expense[]> {
    const query = this.expenseRepository
      .createQueryBuilder('exp')
      .where('exp.branchId = :branchId', { branchId })
      .orderBy('exp.date', 'DESC');
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      query.andWhere('exp.date >= :from', { from: fromDate });
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      toDate.setHours(0, 0, 0, 0);
      query.andWhere('exp.date < :to', { to: toDate });
    }
    return query.getMany();
  }

  async findOne(id: string, branchId: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({ where: { id, branchId } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    return expense;
  }

  async update(id: string, branchId: string, dto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOne(id, branchId);
    if (dto.paymentMethod !== undefined) {
      expense.paymentMethod = dto.paymentMethod as unknown as PaymentMethodExpense;
    }
    const { paymentMethod: _, ...rest } = dto;
    Object.assign(expense, rest);
    return this.expenseRepository.save(expense);
  }

  async remove(id: string, branchId: string): Promise<void> {
    const expense = await this.findOne(id, branchId);
    await this.expenseRepository.remove(expense);
  }

  getSummaryByCategory(branchId: string, from: Date, to: Date) {
    return this.expenseRepository
      .createQueryBuilder('exp')
      .select(['exp.category AS category', 'SUM(exp.amount) AS total', 'SUM(exp.ivaAmount) AS totalIva'])
      .where('exp.branchId = :branchId', { branchId })
      .andWhere('exp.date BETWEEN :from AND :to', { from, to })
      .groupBy('exp.category')
      .orderBy('total', 'DESC')
      .getRawMany();
  }
}

