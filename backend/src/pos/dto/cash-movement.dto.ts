import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CashMovementCategory, CashMovementDirection } from '../entities/pos-cash-movement.entity';

export class CreateCashMovementDto {
  @ApiProperty({ enum: CashMovementDirection })
  @IsEnum(CashMovementDirection)
  direction: CashMovementDirection;

  @ApiProperty({ enum: CashMovementCategory })
  @IsEnum(CashMovementCategory)
  category: CashMovementCategory;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Compra urgente de suministros' })
  @IsString()
  @MaxLength(120)
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
