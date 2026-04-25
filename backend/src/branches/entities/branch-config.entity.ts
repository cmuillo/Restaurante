import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('branch_config')
export class BranchConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.configs)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  // Impuestos
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  tipPercentage: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  serviceChargePercentage: number;

  // Moneda e idioma
  @Column({ length: 10, default: 'USD' })
  currency: string;

  @Column({ length: 5, default: 'es' })
  defaultLanguage: string;

  // Facturación
  @Column({ length: 50, default: 'F-' })
  invoicePrefix: string;

  @Column({ default: 1 })
  invoiceNextNumber: number;

  // Horarios de atención (JSON)
  @Column('jsonb', { nullable: true })
  businessHours: Record<string, { open: string; close: string; closed: boolean }>;

  // Impresoras (JSON)
  @Column('jsonb', { nullable: true })
  printerConfig: Record<string, unknown>;

  // Kiosko
  @Column({ default: true })
  kioskEnabled: boolean;

  @Column({ default: 10 })
  kioskInactivitySeconds: number;

  // ─── Facturación Electrónica — Hacienda CR ───────────────────────────────

  @Column({ default: false })
  haciendaEnabled: boolean;

  /** Tipo de identificación del emisor: 01=física 02=jurídica 03=DIMEX 04=NITE */
  @Column({ nullable: true, length: 2 })
  haciendaTaxIdType: string;

  /** Número de cédula/RUC sin guiones */
  @Column({ nullable: true, length: 12 })
  haciendaTaxId: string;

  /** URL IDP OAuth2 de Hacienda (sandbox vs producción) */
  @Column({ nullable: true })
  haciendaIdpUrl: string;

  /** URL base API de recepción de comprobantes */
  @Column({ nullable: true })
  haciendaApiUrl: string;

  /** Client ID para Hacienda (usualmente "api-stag" en sandbox o "api" en prod) */
  @Column({ nullable: true })
  haciendaClientId: string;

  /** Usuario ATV del contribuyente */
  @Column({ nullable: true })
  haciendaUsername: string;

  /** Contraseña ATV (almacenada cifrada en producción via secreto de servidor) */
  @Column({ nullable: true })
  haciendaPassword: string;

  /** Código de provincia (2 dígitos, tabla Hacienda) */
  @Column({ nullable: true, length: 2 })
  haciendaProvince: string;

  /** Código de cantón (2 dígitos) */
  @Column({ nullable: true, length: 2 })
  haciendaCanton: string;

  /** Código de distrito (2 dígitos) */
  @Column({ nullable: true, length: 2 })
  haciendaDistrict: string;

  /** Código de sucursal para consecutivo (3 dígitos) */
  @Column({ nullable: true, length: 3, default: '001' })
  haciendaBranchCode: string;

  /** Código de terminal para consecutivo (5 dígitos) */
  @Column({ nullable: true, length: 5, default: '00001' })
  haciendaTerminalCode: string;

  /** Ruta al archivo .p12 en el servidor (subido vía API) */
  @Column({ nullable: true })
  haciendaP12Path: string;

  /** Contraseña del archivo .p12 */
  @Column({ nullable: true })
  haciendaP12Password: string;

  /** Ambiente: sandbox | production */
  @Column({ nullable: true, default: 'sandbox' })
  haciendaEnvironment: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
