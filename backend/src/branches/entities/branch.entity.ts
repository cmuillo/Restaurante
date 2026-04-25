import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Table } from '../../tables/entities/table.entity';
import { Category } from '../../menu/entities/category.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { BranchConfig } from './branch-config.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relaciones
  @OneToMany(() => User, (user) => user.branch)
  users: User[];

  @OneToMany(() => Order, (order) => order.branch)
  orders: Order[];

  @OneToMany(() => Table, (table) => table.branch)
  tables: Table[];

  @OneToMany(() => Category, (category) => category.branch)
  categories: Category[];

  @OneToMany(() => InventoryItem, (item) => item.branch)
  inventoryItems: InventoryItem[];

  @OneToMany(() => Expense, (expense) => expense.branch)
  expenses: Expense[];

  @OneToMany(() => AuditLog, (log) => log.branch)
  auditLogs: AuditLog[];

  @OneToMany(() => BranchConfig, (config) => config.branch)
  configs: BranchConfig[];
}
