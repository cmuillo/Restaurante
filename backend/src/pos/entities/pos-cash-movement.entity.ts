import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { PosShift } from './pos-shift.entity';

export enum CashMovementDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum CashMovementCategory {
  CHANGE = 'CHANGE',
  PETTY_CASH = 'PETTY_CASH',
  REPLENISHMENT = 'REPLENISHMENT',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  ADJUSTMENT = 'ADJUSTMENT',
  OTHER = 'OTHER',
}

@Entity('pos_cash_movements')
export class PosCashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column('uuid')
  shiftId: string;

  @ManyToOne(() => PosShift)
  @JoinColumn({ name: 'shiftId' })
  shift: PosShift;

  @Column('uuid')
  createdByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  @Column({ type: 'enum', enum: CashMovementDirection })
  direction: CashMovementDirection;

  @Column({ type: 'enum', enum: CashMovementCategory, default: CashMovementCategory.OTHER })
  category: CashMovementCategory;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
