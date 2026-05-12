import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToOne, JoinColumn, ManyToOne,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
  CREDIT_NOTE = 'credit_note',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  QR = 'qr',
  MIXED = 'mixed',
  CREDIT = 'credit',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @OneToOne(() => Order, (order) => order.invoice)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ unique: true })
  invoiceNumber: string; // ej: F-000023

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.ISSUED })
  status: InvoiceStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  // Desglose del pago (ej: mixto — parte efectivo, parte tarjeta)
  @Column('jsonb', { nullable: true })
  paymentDetails: Record<string, number>;

  @Column({ nullable: true, length: 3, default: 'CRC' })
  currencyCode: string;

  @Column('decimal', { precision: 12, scale: 6, default: 1 })
  exchangeRate: number;

  // Datos del cliente para factura fiscal
  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerTaxId: string; // RFC, NIT, RUC, etc.

  @Column({ nullable: true })
  customerAddress: string;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tipAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  cashReceived: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  change: number;

  @Column('uuid', { nullable: true })
  cancelledByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelledByUserId' })
  cancelledByUser: User;

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ nullable: true })
  cancelledAt: Date;

  // ─── Hacienda CR ───────────────────────────────────────────────────────────

  /** Clave numérica de 50 dígitos exigida por Hacienda */
  @Column({ nullable: true, length: 50, unique: true })
  haciendaKey: string;

  /** Número consecutivo de comprobante (ej: 00100001010000000001) */
  @Column({ nullable: true, length: 20 })
  haciendaConsecutive: string;

  /** Tipo: TE = Tiquete Electrónico, FE = Factura Electrónica, NC = Nota de Crédito, ND = Nota de Débito */
  @Column({ nullable: true, length: 2, default: 'TE' })
  haciendaDocType: string;

  /** Referencia a documento original (para NC y ND) */
  @Column({ nullable: true, length: 2 })
  refDocType: string; // 01=FE, 04=TE, 05=NC

  @Column({ nullable: true, length: 20 })
  refDocNumber: string;

  @Column({ nullable: true })
  refDocDate: Date;

  /** XML firmado enviado a Hacienda (base64) */
  @Column('text', { nullable: true })
  haciendaXml: string;

  /** XML de respuesta de Hacienda (base64) */
  @Column('text', { nullable: true })
  haciendaResponseXml: string;

  /** Estado del comprobante en Hacienda */
  @Column({ nullable: true, default: 'pending' })
  haciendaStatus: string; // pending | sent | accepted | rejected | contingency

  /** Mensaje de error o descripción del rechazo */
  @Column('text', { nullable: true })
  haciendaMessage: string;

  /** Fecha en que Hacienda aceptó o rechazó el comprobante */
  @Column({ nullable: true })
  haciendaProcessedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
