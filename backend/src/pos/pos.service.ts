import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PosShift, ShiftStatus } from './entities/pos-shift.entity';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(PosShift)
    private readonly shiftRepo: Repository<PosShift>,
  ) {}

  async openShift(branchId: string, userId: string, dto: OpenShiftDto): Promise<PosShift> {
    const existing = await this.shiftRepo.findOne({
      where: { branchId, status: ShiftStatus.OPEN },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un turno abierto para esta sucursal');
    }

    const shift = this.shiftRepo.create({
      branchId,
      openedByUserId: userId,
      openingCash: dto.openingCash,
      openedAt: new Date(),
      status: ShiftStatus.OPEN,
    });
    return this.shiftRepo.save(shift);
  }

  async closeShift(branchId: string, userId: string, dto: CloseShiftDto): Promise<PosShift> {
    const shift = await this.shiftRepo.findOne({
      where: { branchId, status: ShiftStatus.OPEN },
    });
    if (!shift) {
      throw new NotFoundException('No hay turno abierto para esta sucursal');
    }

    // Calcular ventas en efectivo del turno
    const result = await this.shiftRepo.manager.query(
      `SELECT COALESCE(SUM(i.cash_received - i.change), 0) as total_cash
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       WHERE o.branch_id = $1
         AND i.payment_method = 'CASH'
         AND i.created_at >= $2
         AND i.status = 'PAID'`,
      [branchId, shift.openedAt],
    );

    const totalCashSales = parseFloat(result[0]?.total_cash ?? 0);
    const expectedCash = Number(shift.openingCash) + totalCashSales;
    const cashDifference = dto.closingCash - expectedCash;

    shift.closedByUserId = userId;
    shift.closingCash = dto.closingCash;
    shift.expectedCash = expectedCash;
    shift.cashDifference = cashDifference;
    shift.closingNotes = dto.closingNotes ?? null;
    shift.closedAt = new Date();
    shift.status = ShiftStatus.CLOSED;

    return this.shiftRepo.save(shift);
  }

  async getCurrentShift(branchId: string): Promise<PosShift | null> {
    return this.shiftRepo.findOne({
      where: { branchId, status: ShiftStatus.OPEN },
      relations: ['openedBy'],
    });
  }

  async getShiftHistory(branchId: string, limit = 20): Promise<PosShift[]> {
    if (limit > 100) limit = 100;
    return this.shiftRepo.find({
      where: { branchId },
      order: { openedAt: 'DESC' },
      take: limit,
      relations: ['openedBy', 'closedBy'],
    });
  }
}
