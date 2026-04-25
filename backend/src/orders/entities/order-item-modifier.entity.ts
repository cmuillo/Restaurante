import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ModifierOption } from '../../menu/entities/modifier-option.entity';

@Entity('order_item_modifiers')
export class OrderItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderItemId: string;

  @ManyToOne(() => OrderItem, (item) => item.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column('uuid')
  modifierOptionId: string;

  @ManyToOne(() => ModifierOption)
  @JoinColumn({ name: 'modifierOptionId' })
  modifierOption: ModifierOption;

  @Column({ length: 100 })
  optionName: string; // snapshot del nombre al momento de la orden

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  extraPrice: number; // snapshot del precio extra
}
