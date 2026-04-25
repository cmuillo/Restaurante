import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ExpenseCategory {
  SUPPLIES = 'SUPPLIES',
  PAYROLL = 'PAYROLL',
  UTILITIES = 'UTILITIES',
  MAINTENANCE = 'MAINTENANCE',
  MARKETING = 'MARKETING',
  RENT = 'RENT',
  OTHER = 'OTHER',
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

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  supplier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receiptNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
