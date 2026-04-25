import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogDto {
  branchId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logRepository: Repository<AuditLog>,
  ) {}

  async log(dto: AuditLogDto): Promise<void> {
    // No lanzar excepción si el log falla — no interrumpir operación principal
    try {
      await this.logRepository.save(dto);
    } catch (err) {
      // En producción, enviar a un servicio de logging externo
      console.error('Error guardando audit log:', err);
    }
  }

  async findAll(
    branchId: string,
    filters?: { action?: string; userId?: string; from?: Date; to?: Date },
    page = 1,
    limit = 50,
  ) {
    const query = this.logRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.branchId = :branchId', { branchId });

    if (filters?.action) {
      query.andWhere('log.action LIKE :action', { action: `%${filters.action}%` });
    }
    if (filters?.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters?.from) {
      query.andWhere('log.createdAt >= :from', { from: filters.from });
    }
    if (filters?.to) {
      query.andWhere('log.createdAt <= :to', { to: filters.to });
    }

    return query
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }
}
