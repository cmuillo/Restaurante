import { IsUUID, IsNotEmpty, IsString, IsNumber, IsDecimal, IsOptional } from 'class-validator';

export class CreateCreditNoteDto {
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

export class UpdateCreditNoteDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CancelCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  cancellationReason: string;
}
