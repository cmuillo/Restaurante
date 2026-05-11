import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { CreateTableDto, UpdateTableDto } from './dto/table.dto';
import { RestaurantGateway } from '../websockets/restaurant.gateway';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private readonly tableRepository: Repository<Table>,
    private readonly gateway: RestaurantGateway,
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
    const table = this.tableRepository.create({
      branchId,
      number: Number(dto.number),
      capacity: dto.capacity,
      name: dto.location,
    });
    const saved = await this.tableRepository.save(table);
    this.gateway.emitTableUpdated(branchId, { id: saved.id, status: saved.status });
    return saved;
  }

  async updateStatus(id: string, branchId: string, status: TableStatus, waiterId?: string): Promise<Table> {
    const updates: Partial<Table> = { status };
    if (waiterId !== undefined) updates.assignedWaiterId = waiterId;
    await this.tableRepository.update({ id, branchId }, updates as any);
    const table = await this.findOne(id, branchId);
    this.gateway.emitTableUpdated(branchId, { id: table.id, status: table.status });
    return table;
  }

  async update(id: string, branchId: string, dto: UpdateTableDto): Promise<Table> {
    const updates: Partial<Table> = {
      ...(dto.number !== undefined ? { number: Number(dto.number) } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.location !== undefined ? { name: dto.location } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    await this.tableRepository.update({ id, branchId }, updates as any);
    const table = await this.findOne(id, branchId);
    this.gateway.emitTableUpdated(branchId, { id: table.id, status: table.status });
    return table;
  }

  async remove(id: string, branchId: string): Promise<void> {
    const table = await this.findOne(id, branchId);
    await this.tableRepository.update(table.id, { isActive: false });
    this.gateway.emitTableUpdated(branchId, { id: table.id, isActive: false });
  }
}
