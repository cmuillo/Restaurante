import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PosShift, ShiftStatus } from './entities/pos-shift.entity';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';
import { CashMovementDirection, PosCashMovement } from './entities/pos-cash-movement.entity';
import { CreateCashMovementDto } from './dto/cash-movement.dto';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(PosShift)
    private readonly shiftRepo: Repository<PosShift>,
    @InjectRepository(PosCashMovement)
    private readonly movementRepo: Repository<PosCashMovement>,
  ) {}

  private async getOpenShift(branchId: string): Promise<PosShift> {
    const shift = await this.shiftRepo.findOne({
      where: { branchId, status: ShiftStatus.OPEN },
      relations: ['openedBy'],
    });
    if (!shift) {
      throw new NotFoundException('No hay turno abierto para esta sucursal');
    }
    return shift;
  }

  private async getSalesBreakdownSince(
    branchId: string,
    openedAt: Date,
  ): Promise<{ cashSales: number; cardSales: number }> {
    const result = await this.shiftRepo.manager.query(
      `SELECT
         COALESCE(SUM(CASE
           WHEN i."paymentMethod" = 'cash' THEN i.total
           WHEN i."paymentMethod" = 'mixed' THEN COALESCE((i."paymentDetails"->>'cash')::numeric, 0)
           ELSE 0
         END), 0) AS total_cash,
         COALESCE(SUM(CASE
           WHEN i."paymentMethod" = 'card' THEN i.total
           WHEN i."paymentMethod" = 'mixed' THEN COALESCE((i."paymentDetails"->>'card')::numeric, 0)
           ELSE 0
         END), 0) AS total_card
       FROM invoices i
       JOIN orders o ON o.id = i."orderId"
       WHERE o."branchId" = $1
         AND i."createdAt" >= $2
         AND i.status = 'issued'`,
      [branchId, openedAt],
    );

    return {
      cashSales: parseFloat(result[0]?.total_cash ?? '0'),
      cardSales: parseFloat(result[0]?.total_card ?? '0'),
    };
  }

  private async getMovementTotals(shiftId: string): Promise<{ totalCashIn: number; totalCashOut: number }> {
    const rows = await this.movementRepo
      .createQueryBuilder('movement')
      .select('movement.direction', 'direction')
      .addSelect('COALESCE(SUM(movement.amount), 0)', 'total')
      .where('movement.shiftId = :shiftId', { shiftId })
      .groupBy('movement.direction')
      .getRawMany();

    const totalCashIn = parseFloat(rows.find((row) => row.direction === CashMovementDirection.IN)?.total ?? '0');
    const totalCashOut = parseFloat(rows.find((row) => row.direction === CashMovementDirection.OUT)?.total ?? '0');

    return { totalCashIn, totalCashOut };
  }

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

  async createCashMovement(branchId: string, userId: string, dto: CreateCashMovementDto) {
    const shift = await this.getOpenShift(branchId);

    const movement = this.movementRepo.create({
      branchId,
      shiftId: shift.id,
      createdByUserId: userId,
      direction: dto.direction,
      category: dto.category,
      amount: dto.amount,
      reason: dto.reason,
      notes: dto.notes ?? '',
    });

    await this.movementRepo.save(movement);
    return this.getCurrentCashState(branchId);
  }

  async getCurrentCashState(branchId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { branchId, status: ShiftStatus.OPEN },
      relations: ['openedBy'],
    });

    if (!shift) {
      return {
        shift: null,
        movements: [],
        totals: null,
      };
    }

    const [movements, salesBreakdown, movementTotals] = await Promise.all([
      this.movementRepo.find({
        where: { shiftId: shift.id },
        relations: ['createdBy'],
        order: { createdAt: 'DESC' },
      }),
      this.getSalesBreakdownSince(branchId, shift.openedAt),
      this.getMovementTotals(shift.id),
    ]);

    return {
      shift,
      movements,
      totals: {
        openingCash: Number(shift.openingCash),
        cashSales: salesBreakdown.cashSales,
        cardSales: salesBreakdown.cardSales,
        totalCashIn: movementTotals.totalCashIn,
        totalCashOut: movementTotals.totalCashOut,
        expectedCash:
          Number(shift.openingCash) +
          salesBreakdown.cashSales +
          movementTotals.totalCashIn -
          movementTotals.totalCashOut,
      },
    };
  }

  async closeShift(branchId: string, userId: string, dto: CloseShiftDto): Promise<PosShift> {
    const shift = await this.getOpenShift(branchId);
    const [salesBreakdown, movementTotals] = await Promise.all([
      this.getSalesBreakdownSince(branchId, shift.openedAt),
      this.getMovementTotals(shift.id),
    ]);

    const expectedCash =
      Number(shift.openingCash) +
      salesBreakdown.cashSales +
      movementTotals.totalCashIn -
      movementTotals.totalCashOut;
    const cashDifference = dto.closingCash - expectedCash;

    shift.closedByUserId = userId;
    shift.closingCash = dto.closingCash;
    shift.expectedCash = expectedCash;
    shift.cashDifference = cashDifference;
    shift.closingNotes = (dto.closingNotes ?? '') as string;
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
