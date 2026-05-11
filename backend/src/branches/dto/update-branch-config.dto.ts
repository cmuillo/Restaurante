import { IsOptional, IsNumber, IsString, IsBoolean, IsInt, Min, Max, MaxLength, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

type BusinessHour = {
  open: string;
  close: string;
  closed: boolean;
};

export class UpdateBranchConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tipPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  language?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoicePrefix?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextInvoiceNumber?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  kioskEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(10)
  kioskInactivitySeconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, BusinessHour>;
}
