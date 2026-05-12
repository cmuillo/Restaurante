import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Invoice } from '../../billing/entities/invoice.entity';
import { User } from '../../users/entities/user.entity';

export enum CreditNoteStatus {
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @Column('uuid')
  invoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ unique: true })
  creditNoteNumber: string; // ej: NC-000001

  @Column({ type: 'enum', enum: CreditNoteStatus, default: CreditNoteStatus.ISSUED })
  status: CreditNoteStatus;

  /** Motivo de la NC: "Devolución", "Error en factura", "Descuento", etc. */
  @Column()
  reason: string;

  /** Monto de la devolución (no puede exceder el monto original) */
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  /** Descripción detallada de por qué se emite la NC */
  @Column({ nullable: true, type: 'text' })
  description: string;

  // ─── Hacienda CR ───────────────────────────────────────────────────────────

  /** Clave numérica de 50 dígitos exigida por Hacienda */
  @Column({ nullable: true, length: 50 })
  haciendaKey: string;

  /** Consecutivo de Hacienda */
  @Column({ nullable: true })
  haciendaConsecutive: string;

  /** Estado respecto a Hacienda */
  @Column({ nullable: true, default: 'pending' })
  haciendaStatus: string;

  /** Respuesta de Hacienda */
  @Column({ nullable: true, type: 'jsonb' })
  haciendaResponse: Record<string, any>;

  // ─── Datos para impresión ─────────────────────────────────────────────────

  @Column({ nullable: true, type: 'jsonb' })
  printable: Record<string, any>;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  @Column('uuid', { nullable: true })
  createdByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('uuid', { nullable: true })
  cancelledByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelledByUserId' })
  cancelledByUser: User;

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ nullable: true })
  cancelledAt: Date;
}
