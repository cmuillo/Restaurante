import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('expense_email_configs')
export class ExpenseEmailConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('uuid', { nullable: true })
  branchId: string;

  @ManyToOne(() => Branch, { nullable: true })
  branch: Branch;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ default: 'imap.gmail.com' })
  imapHost: string;

  @Column({ default: 993 })
  imapPort: number;

  @Column({ default: true })
  imapSecure: boolean;

  @Column({ nullable: true })
  folder: string;
}
