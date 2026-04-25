import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Product } from './product.entity';
import { ModifierOption } from './modifier-option.entity';

export enum ModifierType {
  SINGLE = 'single',   // Selección única (ej: Término)
  MULTIPLE = 'multiple', // Selección múltiple (ej: Extras)
  REMOVAL = 'removal',  // Eliminar ingrediente (ej: Sin cebolla)
}

@Entity('product_modifiers')
export class ProductModifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, (product) => product.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ length: 100 })
  name: string; // ej: "Término de cocción", "Extras", "Sin ingrediente"

  @Column({ type: 'enum', enum: ModifierType, default: ModifierType.SINGLE })
  type: ModifierType;

  @Column({ default: false })
  required: boolean;

  @Column({ default: 6 })
  maxSelections: number; // máx 6 opciones visibles (principio del kiosko)

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => ModifierOption, (option) => option.modifier, { cascade: true })
  options: ModifierOption[];
}
