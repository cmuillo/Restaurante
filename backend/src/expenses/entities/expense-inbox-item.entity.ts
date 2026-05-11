import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';

export enum ExpenseInboxStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('expense_inbox_items')
export class ExpenseInboxItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160, nullable: true })
  sourceEmail: string;

  @Column({ length: 220, nullable: true })
  subject: string;

  @Column({ type: 'timestamp' })
  receivedAt: Date;

  @Column({ length: 150, nullable: true })
  supplierName: string;

  @Column({ length: 20, nullable: true })
  supplierTaxId: string;

  @Column({ length: 50, nullable: true })
  receiptNumber: string;

  @Column({ type: 'date', nullable: true })
  issueDate: Date;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  ivaAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'enum', enum: ExpenseInboxStatus, default: ExpenseInboxStatus.PENDING })
  status: ExpenseInboxStatus;

  @Column({ type: 'text', nullable: true })
  rawXml: string;

  @Column({ type: 'jsonb', nullable: true })
  parsedData: Record<string, unknown>;

  @Column('uuid', { nullable: true })
  branchId: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column('uuid', { nullable: true })
  approvedExpenseId: string;

  @Column('uuid', { nullable: true })
  approvedByUserId: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
