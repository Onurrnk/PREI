// =====================================================================
// PREI | InvestmentTargetsService — kişinin yatırım hedefleri.
//
// "Nereye yatırım yapmak istiyor?" sorusunun tek kaynağı. Hedef KİŞİYE
// bağlıdır (müşteri de aday da aynı kişi kaydı); hangi talepten geldiği
// lead_id ile izlenir ama zorunlu değildir.
//
// Ülke her zaman ISO koduna indirgenir (geo.ts). Çözülemeyen girdi
// REDDEDİLİR — yanlış ülkeye yazmaktansa kullanıcıya sormak daha iyi.
// =====================================================================
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import {
  COUNTRIES, countryByCode, normalizeCountry, normalizeTarget, countryCityConflict,
} from '../../common/geo';

export interface InvestmentTargetRow {
  id: string;
  contact_id: string;
  lead_id: string | null;
  country_code: string;
  region: string | null;
  district: string | null;
  rank: number;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface InvestmentTargetResponse {
  id: string;
  contactId: string;
  leadId: string | null;
  countryCode: string;
  countryName: string;
  region: string | null;
  district: string | null;
  rank: number;
  source: string;
  notes: string | null;
  /** Şehir ülkeyle çelişiyorsa açıklama — sessizce yutulmaz. */
  warning: string | null;
  createdAt: string;
}

export interface InvestmentTargetInput {
  /** Ülke adı, ISO kodu veya şehir ("İspanya", "ES", "Dubai"). */
  country?: string;
  region?: string | null;
  district?: string | null;
  rank?: number;
  leadId?: string | null;
  notes?: string | null;
  source?: string;
}

const SELECT = `
  SELECT id, contact_id, lead_id, country_code, region, district,
         rank, source, notes, created_at::text
    FROM investment_targets`;

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export function toTarget(row: InvestmentTargetRow): InvestmentTargetResponse {
  return {
    id: row.id,
    contactId: row.contact_id,
    leadId: row.lead_id,
    countryCode: row.country_code,
    countryName: countryByCode(row.country_code)?.tr ?? row.country_code,
    region: row.region,
    district: row.district,
    rank: row.rank,
    source: row.source,
    notes: row.notes,
    warning: countryCityConflict(row.country_code, row.region),
    createdAt: row.created_at,
  };
}

@Injectable()
export class InvestmentTargetsService {
  constructor(private readonly db: DatabaseService) {}

  /** Seçilebilir ülke listesi — arayüz bunu kullanır, elle yazım olmaz. */
  countries(): Array<{ code: string; name: string }> {
    return COUNTRIES.map((c) => ({ code: c.code, name: c.tr }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  async listForContact(
    ctx: RequestContext, contactId: string,
  ): Promise<InvestmentTargetResponse[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<InvestmentTargetRow>(
        `${SELECT}
          WHERE contact_id = $1 AND deleted_at IS NULL
          ORDER BY rank, country_code, region NULLS FIRST`,
        [contactId],
      );
      return rows.map(toTarget);
    });
  }

  /** Birden çok kişinin hedefleri — liste ekranları N+1 yapmasın. */
  async listForContacts(
    ctx: RequestContext, contactIds: string[],
  ): Promise<Map<string, InvestmentTargetResponse[]>> {
    if (contactIds.length === 0) return new Map();
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<InvestmentTargetRow>(
        `${SELECT}
          WHERE contact_id = ANY($1::uuid[]) AND deleted_at IS NULL
          ORDER BY rank, country_code`,
        [contactIds],
      );
      const map = new Map<string, InvestmentTargetResponse[]>();
      for (const r of rows) {
        const list = map.get(r.contact_id) ?? [];
        list.push(toTarget(r));
        map.set(r.contact_id, list);
      }
      return map;
    });
  }

  async create(
    ctx: RequestContext, contactId: string, input: InvestmentTargetInput,
  ): Promise<InvestmentTargetResponse> {
    const country = normalizeCountry(input.country);
    if (!country) {
      throw new BadRequestException(
        `Ülke tanınmadı: "${input.country ?? ''}". Listeden bir ülke seçin.`,
      );
    }

    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `SELECT 1 FROM contacts WHERE id = $1 AND deleted_at IS NULL`, [contactId]);
      if (!rowCount) throw new NotFoundException('Kişi bulunamadı.');

      try {
        const { rows } = await c.query<InvestmentTargetRow>(
          `INSERT INTO investment_targets
             (tenant_id, contact_id, lead_id, country_code, region, district,
              rank, source, notes, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
           RETURNING id, contact_id, lead_id, country_code, region, district,
                     rank, source, notes, created_at::text`,
          [ctx.tenantId, contactId, input.leadId ?? null, country.code,
           trimOrNull(input.region), trimOrNull(input.district),
           Math.max(1, Math.min(99, input.rank ?? 1)),
           input.source ?? 'manual', trimOrNull(input.notes), ctx.userId],
        );
        return toTarget(rows[0]);
      } catch (e) {
        throw this.translate(e);
      }
    });
  }

  async update(
    ctx: RequestContext, id: string, input: InvestmentTargetInput,
  ): Promise<InvestmentTargetResponse> {
    return this.db.withContext(ctx, async (c) => {
      const sets: string[] = [];
      const params: unknown[] = [id];
      const push = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (input.country !== undefined) {
        const country = normalizeCountry(input.country);
        if (!country) {
          throw new BadRequestException(`Ülke tanınmadı: "${input.country}".`);
        }
        push('country_code', country.code);
      }
      if (input.region !== undefined) push('region', trimOrNull(input.region));
      if (input.district !== undefined) push('district', trimOrNull(input.district));
      if (input.notes !== undefined) push('notes', trimOrNull(input.notes));
      if (input.rank !== undefined) push('rank', Math.max(1, Math.min(99, input.rank)));
      if (sets.length === 0) throw new BadRequestException('Değiştirilecek alan yok.');
      params.push(ctx.userId);
      sets.push(`updated_by = $${params.length}`);

      try {
        const { rows } = await c.query<InvestmentTargetRow>(
          `UPDATE investment_targets SET ${sets.join(', ')}
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, contact_id, lead_id, country_code, region, district,
                      rank, source, notes, created_at::text`,
          params,
        );
        if (rows.length === 0) throw new NotFoundException('Hedef bulunamadı.');
        return toTarget(rows[0]);
      } catch (e) {
        throw this.translate(e);
      }
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE investment_targets SET deleted_at = now(), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Hedef bulunamadı.');
      return { deleted: true };
    });
  }

  /**
   * Eylül'ün çıkardığı kriterlerden hedefi yazar (varsa dokunmaz).
   *
   * Neden "varsa dokunmaz": danışman elle düzelttiyse yapay zekâ onu
   * ezmemeli. Aynı ülke+bölge zaten varsa sessizce geçilir.
   */
  async upsertFromCriteria(
    ctx: RequestContext,
    contactId: string,
    leadId: string | null,
    criteria: { market?: string | null; city?: string | null; district?: string | null },
  ): Promise<InvestmentTargetResponse | null> {
    // normalizeTarget "Dubai" gibi şehir-pazar karışıklığını da çözer.
    const target = normalizeTarget(criteria.market, criteria.city);
    if (!target) return null;
    const { countryCode, region } = target;

    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<InvestmentTargetRow>(
        `INSERT INTO investment_targets
           (tenant_id, contact_id, lead_id, country_code, region, district, source, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'eylul',$7,$7)
         ON CONFLICT DO NOTHING
         RETURNING id, contact_id, lead_id, country_code, region, district,
                   rank, source, notes, created_at::text`,
        [ctx.tenantId, contactId, leadId, countryCode,
         region, trimOrNull(criteria.district), ctx.userId],
      );
      return rows[0] ? toTarget(rows[0]) : null;
    });
  }

  /** Ülke bazında kaç kişi arıyor — "İspanya'da kaç müşterim var" sorusu. */
  async byCountry(
    ctx: RequestContext,
  ): Promise<Array<{ countryCode: string; countryName: string; contacts: number; regions: string[] }>> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        country_code: string; contacts: string; regions: string[];
      }>(
        `SELECT country_code,
                count(DISTINCT contact_id)::text AS contacts,
                array_remove(array_agg(DISTINCT region), NULL) AS regions
           FROM investment_targets
          WHERE deleted_at IS NULL
          GROUP BY country_code
          ORDER BY count(DISTINCT contact_id) DESC, country_code`,
      );
      return rows.map((r) => ({
        countryCode: r.country_code,
        countryName: countryByCode(r.country_code)?.tr ?? r.country_code,
        contacts: Number(r.contacts),
        regions: r.regions ?? [],
      }));
    });
  }

  private translate(e: unknown): Error {
    const err = e as { code?: string; constraint?: string };
    if (err.code === '23505' && err.constraint === 'uq_inv_targets_unique') {
      return new ConflictException('Bu ülke/bölge bu kişide zaten kayıtlı.');
    }
    return e as Error;
  }
}
