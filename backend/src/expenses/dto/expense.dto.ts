import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, IsBoolean, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

export enum ExpenseCategory {
  SUPPLIES = 'SUPPLIES',
  PAYROLL = 'PAYROLL',
  UTILITIES = 'UTILITIES',
  MAINTENANCE = 'MAINTENANCE',
  MARKETING = 'MARKETING',
  RENT = 'RENT',
  FOOD_COST = 'FOOD_COST',
  TAXES = 'TAXES',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

export enum PaymentMethodExpenseDto {
  CASH = 'cash',
  TRANSFER = 'transfer',
  CARD = 'card',
  CHECK = 'check',
  OTHER = 'other',
}

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ivaAmount?: number;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  supplierName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplierTaxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiptNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiProperty({ enum: PaymentMethodExpenseDto, required: false })
  @IsOptional()
  @IsEnum(PaymentMethodExpenseDto)
  paymentMethod?: PaymentMethodExpenseDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDeductible?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

