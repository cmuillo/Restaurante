import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentMethodExpense {
  CASH = 'cash',
  TRANSFER = 'transfer',
  CARD = 'card',
  CHECK = 'check',
  OTHER = 'other',
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.expenses)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ length: 100 })
  category: string;

  @Column({ length: 200 })
  description: string;

  /** Monto neto sin IVA */
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  /** IVA pagado (13% en CR). Puede ser 0 si exento. */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  ivaAmount: number;

  @Column({ type: 'date' })
  date: Date;

  // ── Datos del proveedor (para deducción Hacienda) ──────────────────────────

  @Column({ length: 150, nullable: true })
  supplierName: string;

  /** Cédula jurídica (3-xxx-xxxxxx) o física (x-xxxx-xxxx) del proveedor */
  @Column({ length: 20, nullable: true })
  supplierTaxId: string;

  /** Número de comprobante electrónico del proveedor */
  @Column({ length: 50, nullable: true })
  receiptNumber: string;

  /** URL del PDF/imagen del comprobante */
  @Column({ nullable: true })
  receiptUrl: string;

  @Column({ type: 'enum', enum: PaymentMethodExpense, default: PaymentMethodExpense.TRANSFER })
  paymentMethod: PaymentMethodExpense;

  /** ¿Cumple requisitos para deducción fiscal? */
  @Column({ default: false })
  isDeductible: boolean;

  @Column({ length: 500, nullable: true })
  notes: string;

  @Column('uuid', { nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
