import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ProductModifier } from './product-modifier.entity';

@Entity('modifier_options')
export class ModifierOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  modifierId: string;

  @ManyToOne(() => ProductModifier, (modifier) => modifier.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'modifierId' })
  modifier: ProductModifier;

  @Column({ length: 100 })
  name: string; // ej: "Bien cocido", "Queso extra"

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  extraPrice: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
