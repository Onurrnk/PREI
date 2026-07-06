// =====================================================================
// PREI | Health — E1 Entegrasyon Sağlık Paneli'nin backend ucu (Faz 1).
// Şimdilik DB ping; WhatsApp/Telegram/Meta kartları kendi fazlarında eklenir.
// =====================================================================
import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    let dbOk: boolean;
    try {
      const rows = await this.db.raw<{ ok: number }>('SELECT 1 AS ok');
      dbOk = rows[0]?.ok === 1;
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      checks: { database: dbOk ? 'ok' : 'fail' },
      ts: new Date().toISOString(),
    };
  }
}
