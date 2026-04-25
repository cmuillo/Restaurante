import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.auditLogs, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column('uuid', { nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 100 })
  action: string; // ej: 'order.cancel', 'price.update', 'user.login'

  @Column({ length: 100, nullable: true })
  entity: string; // ej: 'Order', 'Product', 'User'

  @Column({ nullable: true })
  entityId: string;

  @Column('jsonb', { nullable: true })
  oldValue: Record<string, unknown>; // valor anterior (para cambios)

  @Column('jsonb', { nullable: true })
  newValue: Record<string, unknown>; // valor nuevo

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
