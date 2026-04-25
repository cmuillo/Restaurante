import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateHaciendaConfigDto {
  @IsOptional()
  @IsBoolean()
  haciendaEnabled?: boolean;

  /** 01=física 02=jurídica 03=DIMEX 04=NITE */
  @IsOptional()
  @IsIn(['01', '02', '03', '04'])
  haciendaTaxIdType?: string;

  /** Número de cédula/RUC sin guiones (máximo 12 dígitos) */
  @IsOptional()
  @IsString()
  @Matches(/^\d{9,12}$/, { message: 'haciendaTaxId debe tener entre 9 y 12 dígitos' })
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
