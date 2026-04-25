import {
  IsEnum, IsOptional, IsArray, IsNotEmpty, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../../orders/entities/order.entity';
import { CreateOrderItemDto } from '../../orders/dto/create-order.dto';

export class CreateKioskOrderDto {
  @ApiProperty({ enum: [OrderType.KIOSK, OrderType.TAKEOUT, OrderType.DINE_IN] })
  @IsEnum([OrderType.KIOSK, OrderType.TAKEOUT, OrderType.DINE_IN])
  type: OrderType;

  @ApiPropertyOptional()
  @IsOptional()
  tableId?: never; // El kiosko no asigna mesa

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
