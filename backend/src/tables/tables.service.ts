import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { CreateTableDto, UpdateTableDto } from './dto/table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private readonly tableRepository: Repository<Table>,
  ) {}

  findAll(branchId: string): Promise<Table[]> {
    return this.tableRepository.find({
      where: { branchId, isActive: true },
      relations: ['assignedWaiter'],
      order: { number: 'ASC' },
    });
  }

  async findOne(id: string, branchId: string): Promise<Table> {
    const table = await this.tableRepository.findOne({ where: { id, branchId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    return table;
  }

  async create(branchId: string, dto: CreateTableDto): Promise<Table> {
    const table = this.tableRepository.create({ ...dto, branchId });
    return this.tableRepository.save(table);
  }

  async updateStatus(id: string, branchId: string, status: TableStatus, waiterId?: string): Promise<Table> {
    const updates: Partial<Table> = { status };
    if (waiterId !== undefined) updates.assignedWaiterId = waiterId;
    await this.tableRepository.update({ id, branchId }, updates);
    return this.findOne(id, branchId);
  }

  async update(id: string, branchId: string, dto: UpdateTableDto): Promise<Table> {
    await this.tableRepository.update({ id, branchId }, dto);
    return this.findOne(id, branchId);
  }
}
