import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../menu/entities/product.entity';
import { OrderItemModifier } from './order-item-modifier.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, (product) => product.orderItems)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ length: 150 })
  productName: string; // snapshot del nombre al momento de la orden

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number; // snapshot del precio al momento de la orden

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  notes: string; // instrucciones especiales del cliente

  @OneToMany(() => OrderItemModifier, (mod) => mod.orderItem, { cascade: true })
  modifiers: OrderItemModifier[];
}
