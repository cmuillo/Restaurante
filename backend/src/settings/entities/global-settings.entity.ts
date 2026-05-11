import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('global_settings')
export class GlobalSettings {
  /** Singleton: siempre id = 'main' */
  @PrimaryColumn({ length: 10, default: 'main' })
  id: string;

  // ─── Identidad de la empresa ─────────────────────────────────────────────
  @Column({ length: 150, default: 'Mi Restaurante' })
  restaurantName: string;

  @Column({ length: 255, nullable: true })
  restaurantSlogan: string;

  /** Logo en formato base64 data-URL (ej: data:image/png;base64,...) */
  @Column('text', { nullable: true })
  logoBase64: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 150, nullable: true })
  website: string;

  // ─── Moneda ───────────────────────────────────────────────────────────────
  /** Código ISO 4217 de la moneda (ej: CRC, USD, EUR) */
  @Column({ length: 10, default: 'CRC' })
  currency: string;

  /** Símbolo visual de la moneda (ej: ₡, $, €) */
  @Column({ length: 10, default: '₡' })
  currencySymbol: string;

  /** Locale BCP-47 para formatear números (ej: es-CR, en-US, es-MX) */
  @Column({ length: 10, default: 'es-CR' })
  currencyLocale: string;

  // ─── Apariencia ───────────────────────────────────────────────────────────
  /** Tema de la interfaz admin: 'light' | 'dark' */
  @Column({ length: 10, default: 'light' })
  theme: string;

  /** Color de acento principal de la marca (hex, ej: #ea580c) */
  @Column({ length: 20, default: '#ea580c' })
  brandColor: string;

  /** Logo opcional exclusivo para la pantalla de login (base64). */
  @Column('text', { nullable: true })
  loginLogoBase64: string;

  /** Color inicial del fondo degradado del login. */
  @Column({ length: 20, default: '#EA580C' })
  loginBackgroundColor: string;

  /** Color final del fondo degradado del login. */
  @Column({ length: 20, default: '#C2410C' })
  loginBackgroundColorDark: string;

  // ─── Fiscal / Impuestos ───────────────────────────────────────────────────
  /** Tasa de impuesto por defecto (%) — Costa Rica: 13 */
  @Column('decimal', { precision: 5, scale: 2, default: 13 })
  defaultTaxRate: number;

  /** Porcentajes de propina sugeridos */
  @Column('jsonb', { default: [10, 15, 18] })
  tipSuggestions: number[];

  /** Mensaje de pie de página en facturas impresas */
  @Column({ length: 500, nullable: true })
  invoiceFooterMessage: string;

  // ─── Kiosko ───────────────────────────────────────────────────────────────
  /** Color de fondo de la pantalla de bienvenida del kiosko (hex) */
  @Column({ length: 20, default: '#EA580C' })
  kioskWelcomeColor: string;

  /** Color secundario/acento del kiosko (hex) */
  @Column({ length: 20, default: '#C2410C' })
  kioskWelcomeColorDark: string;

  /** Mensaje principal de bienvenida */
  @Column({ length: 200, default: '¡Bienvenido!' })
  kioskWelcomeMessage: string;

  /** Subtítulo / instrucción del kiosko */
  @Column({ length: 200, default: 'Toca la pantalla para comenzar tu pedido' })
  kioskWelcomeSubtitle: string;

  // ─── Regional ─────────────────────────────────────────────────────────────
  /** Zona horaria IANA (ej: America/Costa_Rica) */
  @Column({ length: 60, default: 'America/Costa_Rica' })
  timezone: string;

  /** Formato de fecha para mostrar (ej: DD/MM/YYYY) */
  @Column({ length: 20, default: 'DD/MM/YYYY' })
  dateFormat: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
