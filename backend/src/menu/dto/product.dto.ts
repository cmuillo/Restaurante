import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  showInKiosk?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(13)
  cabysCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  commercialCodeType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  commercialCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  taxCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  unitOfMeasure?: string;

  @ApiProperty({ required: false, description: 'Puntos que gana el cliente por cada unidad comprada' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerPurchase?: number;

  @ApiProperty({ required: false, description: 'El ítem se sirve en barra, no en cocina' })
  @IsOptional()
  @IsBoolean()
  isBar?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
