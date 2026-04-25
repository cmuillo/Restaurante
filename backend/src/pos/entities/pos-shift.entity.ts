import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('pos_shifts')
export class PosShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column('uuid')
  openedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'openedByUserId' })
  openedBy: User;

  @Column('uuid', { nullable: true })
  closedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closedByUserId' })
  closedBy: User;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  openingCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  closingCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  expectedCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cashDifference: number;

  @Column({ type: 'text', nullable: true })
  closingNotes: string;

  @Column({ type: 'timestamp' })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
