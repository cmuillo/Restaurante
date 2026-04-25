import { IsNumber, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenShiftDto {
  @ApiProperty({ example: 500.0, description: 'Efectivo inicial en caja' })
  @IsNumber()
  @Min(0)
  openingCash: number;
}

export class CloseShiftDto {
  @ApiProperty({ example: 1230.5, description: 'Efectivo contado al cierre' })
  @IsNumber()
  @Min(0)
  closingCash: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingNotes?: string;
}
