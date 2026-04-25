import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('loyalty_transactions')
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.loyaltyTransactions)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'int' })
  points: number; // positivo = ganó puntos, negativo = canjeó

  @Column({ length: 200 })
  description: string;

  @Column({ nullable: true })
  relatedOrderId: string;

  @CreateDateColumn()
  createdAt: Date;
}
