import {
  IsUUID, IsOptional, IsArray, IsNumber, IsString,
  ValidateNested, Min, MaxLength, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { QuotationStatus } from '../entities/quotation.entity';

export class QuotationItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @MaxLength(150)
  productName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateQuotationDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;
}
