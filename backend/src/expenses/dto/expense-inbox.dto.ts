import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ExpenseCategory } from './expense.dto';
import { ExpenseInboxStatus } from '../entities/expense-inbox-item.entity';

export class ListExpenseInboxDto {
  @ApiProperty({ required: false, enum: ExpenseInboxStatus, default: ExpenseInboxStatus.PENDING })
  @IsOptional()
  @IsEnum(ExpenseInboxStatus)
  status?: ExpenseInboxStatus;
}

export class ApproveExpenseInboxItemDto {
  @ApiProperty({ required: false, description: 'Sucursal destino para aprobar (obligatorio si el item no tiene branchId).' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false, enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
