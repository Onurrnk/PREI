// =====================================================================
// PREI | Proje Girişi (intake) DTO'ları.
// Admin: davet linki üret / inceleme. Public: geliştirici proje gönderimi.
// Global ValidationPipe(whitelist + transform) aktif — multipart metin
// alanları sayıya @Type ile çevrilir.
// =====================================================================
import { Type } from 'class-transformer';
import {
  IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];
const MARKETS = ['TR', 'AE', 'ES', 'GB', 'TH', 'DE'];

// --- Admin: davet linki üretimi ---
export class CreateInviteDto {
  @IsOptional() @IsUUID()
  developerId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  label?: string;

  /** Gün cinsinden geçerlilik; yoksa süresiz. */
  @IsOptional() @IsInt() @Min(1) @Max(365)
  expiresInDays?: number;

  /** Azami kullanım; yoksa sınırsız (v1.1 varsayılan: çok kullanımlık). */
  @IsOptional() @IsInt() @Min(1) @Max(1000)
  maxUses?: number;
}

// --- Admin: onay/red ---
export class ReviewSubmissionDto {
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

// --- Public: geliştirici proje gönderimi (multipart metin alanları) ---
export class SubmitProjectDto {
  @IsString() @MinLength(2) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @IsOptional() @IsString() @MaxLength(120)
  district?: string;

  /** Mahalle — harita odaklama + adres alanı. */
  @IsOptional() @IsString() @MaxLength(120)
  neighborhood?: string;

  /** Opsiyonel ilan linki (sahibinden vb.) — 2. el / emlakçı ürünleri. */
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500)
  listingUrl?: string;

  @IsOptional() @IsIn(MARKETS)
  marketCode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  priceMin?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  priceMax?: number;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  commissionPct?: number;

  /** Virgülle ayrılmış daire tipleri (ör. "1+1, 2+1, Villa"). */
  @IsOptional() @IsString() @MaxLength(400)
  unitTypes?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsISO8601()
  completionDate?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  latitude?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  longitude?: number;

  /** Ön ödeme yüzdesi (ör. 40 = %40 peşin). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  downPaymentPct?: number;

  /** Taksit süresi (ay). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(360)
  installmentMonths?: number;

  /** Ödeme planı serbest notu (ör. "60/40 teslimde, faizsiz"). */
  @IsOptional() @IsString() @MaxLength(500)
  paymentNote?: string;
}
