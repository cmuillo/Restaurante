import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, OneToOne,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { Table } from '../../tables/entities/table.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { OrderItem } from './order-item.entity';
import { Invoice } from '../../billing/entities/invoice.entity';

export enum OrderType {
  DINE_IN = 'dine_in',     // comer aquí
  TAKEOUT = 'takeout',     // para llevar
  KIOSK = 'kiosk',         // autopedido en kiosko
  DELIVERY = 'delivery',   // a domicilio
}

export enum OrderStatus {
  PENDING = 'pending',             // recibido, esperando preparación
  IN_PREPARATION = 'in_preparation', // en cocina
  READY = 'ready',                 // listo para entregar
  DELIVERED = 'delivered',         // entregado a la mesa
  CANCELLED = 'cancelled',         // cancelado
  COMPLETED = 'completed',         // pagado y cerrado
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.orders)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ unique: true })
  orderNumber: number; // número secuencial por sucursal para mostrar a cliente

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column('uuid', { nullable: true })
  tableId: string;

  @ManyToOne(() => Table, (table) => table.orders, { nullable: true })
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column('uuid', { nullable: true })
  userId: string; // mesero o cajero que tomó la orden

  @ManyToOne(() => User, (user) => user.orders, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid', { nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  tipPercentage: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tipAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ default: 0 })
  pointsUsed: number; // puntos usados en esta orden como descuento

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  pointsDiscount: number; // valor en dinero de los puntos usados

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ nullable: true })
  preparationStartedAt: Date;

  @Column({ nullable: true })
  kitchenPrintedAt: Date;

  @Column({ nullable: true })
  readyAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToOne(() => Invoice, (invoice) => invoice.order)
  invoice: Invoice;
}
