import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('branch_config')
export class BranchConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.configs)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  // Impuestos
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  tipPercentage: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  serviceChargePercentage: number;

  // Moneda e idioma
  @Column({ length: 10, default: 'USD' })
  currency: string;

  @Column({ length: 5, default: 'es' })
  defaultLanguage: string;

  // Facturación
  @Column({ length: 50, default: 'F-' })
  invoicePrefix: string;

  @Column({ default: 1 })
  invoiceNextNumber: number;

  // Horarios de atención (JSON)
  @Column('jsonb', { nullable: true })
  businessHours: Record<string, { open: string; close: string; closed: boolean }>;

  // Impresoras (JSON)
  @Column('jsonb', { nullable: true })
  printerConfig: Record<string, unknown>;

  // Kiosko
  @Column({ default: true })
  kioskEnabled: boolean;

  @Column({ default: 10 })
  kioskInactivitySeconds: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
