import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional() @IsString() @MaxLength(20)
  durationLabel?: string;

  @IsOptional() @IsString() @MaxLength(120)
  client?: string;

  /** Davetli e-postası — verilirse Google Takvim etkinliğine attendee eklenir
   *  (davet gider, müşterinin takviminde de görünür). */
  @IsOptional() @IsEmail()
  clientEmail?: string;

  /** Yüz yüze görüşmede adres/mekan (Google Takvim'de haritalı gösterilir);
   *  Zoom'da toplantı linki. */
  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  /** Telefon görüşmesinde aranacak numara. */
  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsIn(['In-person', 'Zoom', 'Phone'])
  platform?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsIn(['meeting', 'viewing', 'signing'])
  kind?: string;
}
