import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Calendly'den (n8n Calendly Trigger) gelen randevu — tasks(type=meeting)
// satırına dönüşür; Meetings takvimi bu tablodan beslenir.
export class MeetingEventDto {
  @IsString() @MinLength(2) @MaxLength(160)
  invitee_name!: string;

  @IsEmail()
  invitee_email!: string;

  /** Randevu başlangıcı (ISO 8601, Calendly start_time). */
  @IsISO8601()
  start_time!: string;

  @IsOptional() @IsISO8601()
  end_time?: string;

  /** Calendly event tipi adı (örn. "30 Minute Meeting"). */
  @IsOptional() @IsString() @MaxLength(200)
  event_name?: string;

  /** Zoom katılım linki (Calendly location.join_url). */
  @IsOptional() @IsString() @MaxLength(500)
  join_url?: string;

  /** Calendly event URI — idempotency anahtarı (aynı randevu iki kez yazılmaz). */
  @IsOptional() @IsString() @MaxLength(300)
  external_id?: string;
}

/** Saf yardımcı — testlenebilir: başlık + süre türetimi. */
export function buildMeetingTask(dto: Pick<MeetingEventDto, 'invitee_name' | 'event_name' | 'start_time' | 'end_time'>): {
  title: string;
  durationMinutes: number;
} {
  const eventName = dto.event_name?.trim();
  const title = eventName && eventName.length > 0
    ? `${eventName} — ${dto.invitee_name}`
    : `Yatırım Görüşmesi — ${dto.invitee_name}`;

  let durationMinutes = 30; // Calendly varsayılan etkinliğimiz 30 dk
  if (dto.end_time) {
    const ms = Date.parse(dto.end_time) - Date.parse(dto.start_time);
    if (Number.isFinite(ms) && ms > 0) durationMinutes = Math.round(ms / 60000);
  }
  return { title, durationMinutes };
}
