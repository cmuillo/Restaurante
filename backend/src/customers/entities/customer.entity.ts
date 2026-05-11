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

  @Column({ length: 50, unique: true, nullable: true })
  code: string; // código autoincremental CUST-00001

  @Column({ length: 150, unique: true, nullable: true })
  email: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 50, nullable: true })
  taxId: string; // RFC, NIT, RUC, etc. - Alfanumérica (Hacienda 4.4)

  @Column({ length: 2, nullable: true })
  taxIdType: string; // '01' Física, '02' Jurídica, '03' DIMEX, '04' NITE

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ default: 0 })
  loyaltyPoints: number;

  @Column({ nullable: true })
  birthdate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => LoyaltyTransaction, (tx) => tx.customer)
  loyaltyTransactions: LoyaltyTransaction[];
}
