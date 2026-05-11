import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Configuración centralizada de SMTP para envío de correos.
 * Singleton: siempre id = 'main'
 */
@Entity('email_config')
export class EmailConfig {
  @PrimaryColumn({ length: 10, default: 'main' })
  id: string;

  // ─── Configuración SMTP ────────────────────────────────────────────────────
  /** Host del servidor SMTP (ej: smtp.gmail.com, mail.tuproveedor.com) */
  @Column({ length: 100, nullable: true })
  smtpHost: string;

  /** Puerto SMTP (típicamente 587 o 465) */
  @Column({ type: 'integer', nullable: true })
  smtpPort: number;

  /** Usuario/email de autenticación SMTP */
  @Column({ length: 150, nullable: true })
  smtpUser: string;

  /** Contraseña SMTP (almacenada encriptada en producción) */
  @Column({ length: 500, nullable: true })
  smtpPassword: string;

  /** Usar TLS seguro (true = 465, false = 587) */
  @Column({ type: 'boolean', default: false })
  smtpSecure: boolean;

  // ─── Identidad del remitente ────────────────────────────────────────────────
  /** Email remitente (from) para todos los correos automáticos */
  @Column({ length: 150, nullable: true })
  senderEmail: string;

  /** Nombre del remitente (ej: "Restaurante Mi Negocio") */
  @Column({ length: 150, nullable: true })
  senderName: string;

  // ─── Estados ────────────────────────────────────────────────────────────────
  /** Si está habilitado el envío de correos */
  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  /** Última actualización */
  @UpdateDateColumn()
  updatedAt: Date;
}
