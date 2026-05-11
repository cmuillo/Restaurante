import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Expense, PaymentMethodExpense } from './entities/expense.entity';
import { CreateExpenseDto, ExpenseCategory, UpdateExpenseDto } from './dto/expense.dto';
import { ExpenseInboxItem, ExpenseInboxStatus } from './entities/expense-inbox-item.entity';
import { ApproveExpenseInboxItemDto } from './dto/expense-inbox.dto';
import { UserRole } from '../users/entities/user.entity';
import { ExpenseEmailConfig } from './entities/expense-email-config.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseInboxItem) private readonly inboxRepository: Repository<ExpenseInboxItem>,
    @InjectRepository(ExpenseEmailConfig) private readonly emailConfigRepository: Repository<ExpenseEmailConfig>,
  ) {}

  // Configuración de correo para ingestión de facturas
  async getEmailConfig(branchId?: string): Promise<ExpenseEmailConfig | null> {
    if (branchId) {
      const config = await this.emailConfigRepository.findOne({ where: { branchId } });
      if (config) return config;
    }
    // Si no hay config por sucursal, buscar global
    return this.emailConfigRepository.findOne({ where: { branchId: IsNull() } });
  }

  async setEmailConfig(data: Partial<ExpenseEmailConfig>): Promise<ExpenseEmailConfig> {
    let config: ExpenseEmailConfig | null = null;
    if (data.id) {
      config = await this.emailConfigRepository.findOne({ where: { id: data.id } });
    } else if (data.branchId) {
      config = await this.emailConfigRepository.findOne({ where: { branchId: data.branchId } });
    }
    if (config) {
      Object.assign(config, data);
      return this.emailConfigRepository.save(config);
    } else {
      const newConfig = this.emailConfigRepository.create(data);
      return this.emailConfigRepository.save(newConfig);
    }
  }

  private toDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

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

  findAll(branchId?: string, from?: Date, to?: Date): Promise<Expense[]> {
    const query = this.expenseRepository
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.branch', 'branch')
      .orderBy('exp.date', 'DESC');

    if (branchId) {
      query.where('exp.branchId = :branchId', { branchId });
    }

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

  findInboxItems(branchId?: string, status: ExpenseInboxStatus = ExpenseInboxStatus.PENDING) {
    const query = this.inboxRepository
      .createQueryBuilder('inbox')
      .leftJoinAndSelect('inbox.branch', 'branch')
      .orderBy('inbox.receivedAt', 'DESC');

    if (status) {
      query.where('inbox.status = :status', { status });
    }

    if (branchId) {
      query.andWhere('inbox.branchId = :branchId', { branchId });
    }

    return query.getMany();
  }

  async approveInboxItem(id: string, dto: ApproveExpenseInboxItemDto, user: any) {
    const item = await this.inboxRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Factura de bandeja no encontrada');

    if (item.status !== ExpenseInboxStatus.PENDING) {
      throw new BadRequestException('Esta factura ya fue procesada');
    }

    const targetBranchId = item.branchId || dto.branchId || user.branchId;
    if (!targetBranchId) {
      throw new BadRequestException('Debes seleccionar una sucursal para aprobar esta factura.');
    }

    if (user.role !== UserRole.SUPER_ADMIN && targetBranchId !== user.branchId) {
      throw new BadRequestException('No puedes aprobar gastos fuera de tu sucursal.');
    }

    const amount = Number(item.amount || 0);
    const ivaAmount = Number(item.ivaAmount || 0);

    const createExpenseDto: CreateExpenseDto = {
      category: dto.category ?? ExpenseCategory.OTHER,
      description: dto.description || item.subject || `Factura ${item.receiptNumber || item.id.slice(0, 8)}`,
      amount,
      ivaAmount,
      date: this.toDateInput(item.issueDate ? new Date(item.issueDate) : new Date()),
      supplierName: item.supplierName || undefined,
      supplierTaxId: item.supplierTaxId || undefined,
      receiptNumber: item.receiptNumber || undefined,
      paymentMethod: undefined,
      isDeductible: true,
      notes: dto.notes || `Aprobado desde bandeja de correo (${item.sourceEmail || 'sin remitente'})`,
    };

    const expense = await this.create(targetBranchId, createExpenseDto, user.id);

    item.status = ExpenseInboxStatus.APPROVED;
    item.branchId = targetBranchId;
    item.approvedExpenseId = expense.id;
    item.approvedByUserId = user.id;
    item.approvedAt = new Date();
    await this.inboxRepository.save(item);

    return { inboxItem: item, expense };
  }

  getSummaryByCategory(branchId: string | undefined, from: Date, to: Date) {
    const query = this.expenseRepository
      .createQueryBuilder('exp')
      .select(['exp.category AS category', 'SUM(exp.amount) AS total', 'SUM(exp.ivaAmount) AS totalIva'])
      .andWhere('exp.date BETWEEN :from AND :to', { from, to })
      .groupBy('exp.category')
      .orderBy('total', 'DESC');

    if (branchId) {
      query.andWhere('exp.branchId = :branchId', { branchId });
    }

    return query.getRawMany();
  }
}

