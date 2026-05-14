import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Quotation } from './quotation.entity';

@Entity('quotation_items')
export class QuotationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  quotationId: string;

  @ManyToOne(() => Quotation, (q) => q.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotationId' })
  quotation: Quotation;

  @Column('uuid', { nullable: true })
  productId: string;

  @Column({ length: 150 })
  productName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { precision: 5, scale: 2, default: 13 })
  taxRate: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;
}
