// =====================================================================
// PREI | Adayın pipeline kaydını garantiler.
//
// NEDEN VAR: Müşteriler dizini yalnız lifecycle_stage='customer' gösterir,
// Adaylar ekranı ise leads tablosundan beslenir. Lead kaydı OLMAYAN bir
// aday hiçbir listede görünmüyordu — canlıda 19 Temmuz'da elle eklenen
// gerçek bir kişi 10 gün boyunca kayıptı. CSV içe aktarımı da lead
// açmadığı için toplu yüklemede aynı sessiz kayıp yaşanacaktı.
//
// Çözüm: aday olarak doğan her kişiye status='new' bir lead açılır —
// kullanıcının modeliyle birebir: "Adaylar = yeni gelen, yanıtlanmamış".
// =====================================================================
import type { PoolClient } from 'pg';
import type { RequestContext } from '../../common/request-context';

/** Lead'in nereden doğduğu — metadata'ya yazılır, kaynak takibi için. */
export type ProspectOrigin = 'manual_contact' | 'contact_import';

/**
 * Kişinin aktif lead'i yoksa açar. Idempotent: WHERE NOT EXISTS ile
 * korunur, iki kez çağrılırsa ikinci kayıt oluşmaz.
 * @returns yeni lead açıldıysa true
 */
export async function ensureProspectLead(
  c: PoolClient, ctx: RequestContext, contactId: string, origin: ProspectOrigin,
): Promise<boolean> {
  const { rowCount } = await c.query(
    `INSERT INTO leads (tenant_id, contact_id, status, metadata, created_by, updated_by)
     SELECT $1, $2, 'new', $3::jsonb, $4, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM leads WHERE contact_id = $2 AND deleted_at IS NULL
      )`,
    [ctx.tenantId, contactId, JSON.stringify({ created_via: origin }), ctx.userId],
  );
  return (rowCount ?? 0) > 0;
}
