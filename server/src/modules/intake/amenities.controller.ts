// =====================================================================
// PREI | Olanak kataloğu ucu — KORUMASIZ.
//
// Neden ayrı dosya: PublicIntakeController sınıf düzeyinde
// SubmissionTokenGuard taşıyor; oraya konursa guard "amenities"i davet
// token'ı sanıp 401 veriyor. Katalog sabit ve gizli değil — form daha
// token doğrulanmadan da listeyi çizebilmeli.
// =====================================================================
import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { amenityCatalog } from './amenities';

@Controller('public/amenities')
export class AmenitiesController {
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list() {
    return amenityCatalog();
  }
}
