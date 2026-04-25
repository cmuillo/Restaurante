import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductModifier } from './product-modifier.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('text', { array: true, default: '{}' })
  allergens: string[]; // datos de alérgenos para informar al cliente

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  showInKiosk: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  sku: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProductModifier, (modifier) => modifier.product, { cascade: true })
  modifiers: ProductModifier[];

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems: OrderItem[];
}
