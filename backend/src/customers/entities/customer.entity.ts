import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { LoyaltyTransaction } from './loyalty-transaction.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150, unique: true, nullable: true })
  email: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ nullable: true })
  taxId: string; // RFC, NIT, RUC, etc.

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ default: 0 })
  loyaltyPoints: number;

  @Column({ nullable: true })
  birthdate: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => LoyaltyTransaction, (tx) => tx.customer)
  loyaltyTransactions: LoyaltyTransaction[];
}
