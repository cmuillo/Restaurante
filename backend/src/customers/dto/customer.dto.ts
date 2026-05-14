import { IsString, IsOptional, IsEmail, IsDateString, MaxLength, IsBoolean, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ required: false, description: 'Cédula/RUC alfanumérica (Hacienda 4.4)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiProperty({ required: false, enum: ['01', '02', '03', '04'] })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  taxIdType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ required: false, description: 'Fecha de nacimiento (opcional, formato YYYY-MM-DD)' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || !value ? undefined : value))
  @ValidateIf((obj) => obj.birthdate !== undefined)
  @IsDateString()
  birthdate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ required: false, description: 'Exonerado de IVA' })
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;

  @ApiProperty({ required: false, description: 'Número de documento de exoneración' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  exemptDocNumber?: string;
}

export class UpdateCustomerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ required: false, description: 'Cédula/RUC alfanumérica (Hacienda 4.4)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiProperty({ required: false, enum: ['01', '02', '03', '04'] })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  taxIdType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ required: false, description: 'Fecha de nacimiento (opcional, formato YYYY-MM-DD)' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || !value ? undefined : value))
  @ValidateIf((obj) => obj.birthdate !== undefined)
  @IsDateString()
  birthdate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Exonerado de IVA' })
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;

  @ApiProperty({ required: false, description: 'Número de documento de exoneración' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  exemptDocNumber?: string;
}
