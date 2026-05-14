import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { QuotationItem } from './quotation-item.entity';

export enum QuotationStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  INVOICED = 'invoiced',
  EXPIRED = 'expired',
}

@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @Column({ length: 20 })
  quotationNumber: string; // e.g. "COT-000001"

  @Column({ type: 'enum', enum: QuotationStatus, default: QuotationStatus.DRAFT })
  status: QuotationStatus;

  @Column('uuid', { nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true, eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @OneToMany(() => QuotationItem, (item) => item.quotation, { cascade: true, eager: true })
  items: QuotationItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
