import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateHaciendaConfigDto {
  @IsOptional()
  @IsBoolean()
  haciendaEnabled?: boolean;

  /** 01=física 02=jurídica 03=DIMEX 04=NITE */
  @IsOptional()
  @IsIn(['01', '02', '03', '04'])
  haciendaTaxIdType?: string;

  /** Cédula/RUC alfanumérica - Hacienda 4.4 compliance
   * Jurídica: 3-101-999999 (acepta solo números)
   * Física: X-XXXX-XXXX (acepta solo números)
   * DIMEX: acepta alfanuméricos
   * NITE: acepta alfanuméricos
   * Se guarda sin guiones, máximo 50 caracteres
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9\-]{6,50}$/i, { message: 'haciendaTaxId debe ser alfanumérico válido (Hacienda 4.4)' })
  haciendaTaxId?: string;

  @IsOptional()
  @IsString()
  haciendaIdpUrl?: string;

  @IsOptional()
  @IsString()
  haciendaApiUrl?: string;

  @IsOptional()
  @IsString()
  haciendaClientId?: string;

  @IsOptional()
  @IsString()
  haciendaUsername?: string;

  /** Se acepta en texto plano; el servicio aplica manejo seguro */
  @IsOptional()
  @IsString()
  haciendaPassword?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  haciendaProvince?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  haciendaCanton?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  haciendaDistrict?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  haciendaBranchCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,5}$/)
  haciendaTerminalCode?: string;

  @IsOptional()
  @IsString()
  haciendaP12Password?: string;

  @IsOptional()
  @IsIn(['sandbox', 'production'])
  haciendaEnvironment?: string;
}
