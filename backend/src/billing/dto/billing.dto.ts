import { IsEnum, IsObject, IsOptional, IsString, IsNumber, IsUUID, Min, MaxLength, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  paymentDetails?: Record<string, number>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerTaxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @ApiProperty({ required: false, description: 'Puntos a usar como descuento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsUsed?: number;
}

export class CreateCreditNoteDto {
  @ApiProperty({ description: 'Motivo de la nota de credito' })
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class SendInvoiceEmailDto {
  @ApiProperty({ description: 'Correo destino para enviar la factura' })
  @IsEmail()
  @MaxLength(150)
  email: string;
}
