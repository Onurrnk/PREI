// =====================================================================
// PREI | PublicUnsubscribeController — /api/public/unsubscribe (KİMLİKSİZ).
// Kriter-eşleşmeli maildeki abonelikten-çık linki buraya düşer. Token HMAC
// ile doğrulanır → marketing_consent=false (KVKK). Basit HTML onay döner.
// Sıkı rate-limit. n8n/JWT gerekmez.
// =====================================================================
import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IntakeService } from './intake.service';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(title: string, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  body { margin:0; background:#17131E; color:#EDE8F2; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { max-width:440px; padding:40px 32px; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 12px; color:#fff; }
  p { color:#B9AEC9; line-height:1.55; margin:0 0 8px; }
  .mark { font-size:2.5rem; margin-bottom:8px; }
  a { color:#B98BD6; }
</style></head><body><div class="card">${body}</div></body></html>`;
}

@Controller('public/unsubscribe')
export class PublicUnsubscribeController {
  constructor(private readonly intake: IntakeService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async unsubscribe(
    @Query('c') contactId?: string,
    @Query('t') token?: string,
    @Query('lang') lang?: string,
  ): Promise<string> {
    const en = lang === 'en';
    const res = await this.intake.unsubscribe(String(contactId ?? ''), String(token ?? ''));
    if (!res.ok) {
      return page(
        en ? 'Invalid link' : 'Geçersiz bağlantı',
        `<div class="mark">⚠️</div><h1>${en ? 'This link is invalid or expired' : 'Bu bağlantı geçersiz veya süresi dolmuş'}</h1>
         <p>${en ? 'If you want to opt out, reply to our email and we will remove you.' : 'Abonelikten çıkmak isterseniz e-postamızı yanıtlayın, sizi listeden çıkaralım.'}</p>`,
      );
    }
    const who = res.name ? esc(res.name) : '';
    return page(
      en ? 'Unsubscribed' : 'Abonelikten çıkıldı',
      `<div class="mark">✅</div><h1>${en ? 'You have been unsubscribed' : 'Aboneliğiniz iptal edildi'}</h1>
       <p>${en
         ? `${who ? who + ', you' : 'You'} will no longer receive new-project match emails from ProDuality.`
         : `${who ? who + ', artık' : 'Artık'} ProDuality'den yeni-proje eşleşme e-postaları almayacaksınız.`}</p>
       <p>${en ? 'Changed your mind? Just reply to any of our emails.' : 'Fikrinizi mi değiştirdiniz? Herhangi bir e-postamızı yanıtlamanız yeterli.'}</p>`,
    );
  }
}
