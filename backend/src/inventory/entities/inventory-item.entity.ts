import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { InventoryTransaction } from './inventory-transaction.entity';

export enum InventoryUnit {
  UNIT = 'unit',
  KG = 'kg',
  GRAM = 'gram',
  LITER = 'liter',
  ML = 'ml',
  PORTION = 'portion',
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.inventoryItems)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'enum', enum: InventoryUnit, default: InventoryUnit.UNIT })
  unit: InventoryUnit;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  currentStock: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  minStock: number; // alerta de reposición al llegar aquí

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  costPerUnit: number;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => InventoryTransaction, (tx) => tx.inventoryItem)
  transactions: InventoryTransaction[];
}
