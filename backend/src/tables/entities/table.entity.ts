import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

export enum TableStatus {
  FREE = 'free',
  OCCUPIED = 'occupied',
  WAITING_FOOD = 'waiting_food',
  BILL_REQUESTED = 'bill_requested',
  RESERVED = 'reserved',
}

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.tables)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  number: number;

  @Column({ length: 50, nullable: true })
  name: string; // nombre descriptivo, ej: "Terraza 1"

  @Column({ default: 4 })
  capacity: number;

  @Column({ type: 'enum', enum: TableStatus, default: TableStatus.FREE })
  status: TableStatus;

  @Column('uuid', { nullable: true })
  assignedWaiterId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedWaiterId' })
  assignedWaiter: User;

  // Posición en el mapa visual del salón
  @Column('decimal', { precision: 6, scale: 2, default: 0 })
  positionX: number;

  @Column('decimal', { precision: 6, scale: 2, default: 0 })
  positionY: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (order) => order.table)
  orders: Order[];
}
