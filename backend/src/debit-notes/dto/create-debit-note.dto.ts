import { IsUUID, IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateDebitNoteDto {
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateDebitNoteDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CancelDebitNoteDto {
  @IsString()
  @IsNotEmpty()
  cancellationReason: string;
}
