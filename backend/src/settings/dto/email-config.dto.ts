import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNumber, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateEmailConfigDto {
  @ApiProperty({ description: 'Host del servidor SMTP', example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  smtpHost?: string;

  @ApiProperty({ description: 'Puerto SMTP', example: 587 })
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiProperty({ description: 'Usuario SMTP', example: 'info@restaurante.com' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  smtpUser?: string;

  @ApiProperty({ description: 'Contraseña SMTP' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  smtpPassword?: string;

  @ApiProperty({ description: 'Usar conexión segura (TLS/SSL)', example: true })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiProperty({ description: 'Email remitente para correos automáticos', example: 'noreply@restaurante.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  senderEmail?: string;

  @ApiProperty({ description: 'Nombre del remitente', example: 'Mi Restaurante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  senderName?: string;

  @ApiProperty({ description: 'Habilitar envío de correos', example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class GetEmailConfigDto {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  senderEmail: string;
  senderName: string;
  isEnabled: boolean;
  updatedAt: Date;
  // NOTA: No retornamos smtpPassword por seguridad
}
