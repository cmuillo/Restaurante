import {
  IsString, IsOptional, IsNumber, IsArray, MaxLength, IsHexColor,
  IsIn, Min, Max, IsEmail, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

const CURRENCIES = ['CRC', 'USD', 'EUR', 'MXN', 'COP', 'PEN', 'CLP', 'ARS', 'BRL', 'GTQ', 'HNL', 'NIO', 'PAB', 'DOP'];
const THEMES = ['light', 'dark'];
const TIMEZONES = [
  'America/Costa_Rica', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Mexico_City',
  'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Sao_Paulo', 'America/Buenos_Aires', 'Europe/Madrid',
];

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(150)
  restaurantName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  restaurantSlogan?: string;

  /** Base64 data-URL del logo. Máx ~2MB. Enviar null para eliminar. */
  @IsOptional() @IsString() @MaxLength(3_000_000)
  logoBase64?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(100)
  email?: string;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string;

  @IsOptional() @IsString() @MaxLength(150)
  website?: string;

  @IsOptional() @IsString() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(10)
  currencySymbol?: string;

  @IsOptional() @IsString() @MaxLength(10)
  currencyLocale?: string;

  @IsOptional() @IsString() @IsIn(THEMES)
  theme?: string;

  @IsOptional() @IsString() @MaxLength(20)
  brandColor?: string;

  /** Base64 data-URL del logo del login. Enviar null para restaurar logo principal. */
  @IsOptional() @IsString() @MaxLength(3_000_000)
  loginLogoBase64?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  loginBackgroundColor?: string;

  @IsOptional() @IsString() @MaxLength(20)
  loginBackgroundColorDark?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  defaultTaxRate?: number;

  @IsOptional() @IsArray() @IsNumber({}, { each: true })
  tipSuggestions?: number[];

  @IsOptional() @IsString() @MaxLength(500)
  invoiceFooterMessage?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kioskWelcomeColor?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kioskWelcomeColorDark?: string;

  @IsOptional() @IsString() @MaxLength(200)
  kioskWelcomeMessage?: string;

  @IsOptional() @IsString() @MaxLength(200)
  kioskWelcomeSubtitle?: string;

  @IsOptional() @IsString() @IsIn(TIMEZONES)
  timezone?: string;

  @IsOptional() @IsString() @MaxLength(20)
  dateFormat?: string;
}
