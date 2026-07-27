// =====================================================================
// PREI | ContactImportService — toplu kişi aktarımının DB katmanı.
//
// İki uç, TEK mantık: önizleme (dryRun) ve gerçek aktarım aynı kodu
// çalıştırır; tek fark yazma adımının atlanması. Böylece "önizlemede
// gördüğüm sonuç çıkmadı" durumu yapısal olarak imkânsız.
//
// Mükerrer politikası — içe aktarımda tekil kayıttan FARKLI:
// ContactsRepository.create() eşleşme bulunca mevcut dosyaya görünür
// "🔁 Mükerrer kayıt" notu düşer. Toplu aktarımda bu doğru davranış DEĞİL:
// kullanıcı dosyayı düzeltip yeniden yükleyecek (beklenen akış) ve her
// tur yüzlerce not birikecekti. Burada eşleşen kayıt sessizce kullanılır,
// sonuç raporunda "mevcut kayıtla eşleşti" olarak sayılır.
//
// Eşleşen kişiye de yatırım hedefi YAZILIR: yeniden yükleme bir
// zenginleştirme turu olur (ON CONFLICT DO NOTHING, mevcut hedef ezilmez).
//
// Kapsam sınırı (bilinçli): bu sürüm lead/fırsat AÇMAZ. Kişi rehberi ve
// yatırım hedefleri girer, satış hattı girmez. CSV'den "bu kişi hangi
// aşamada" çıkarmak tahmin olurdu; boru hattını uydurma kayıtla doldurmak
// boş bırakmaktan kötüdür. Gerçek aktarım sonrası ihtiyaç görülürse eklenir.
// =====================================================================
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import type { RequestContext } from '../../../common/request-context';
import { draftsFromCsv, type ContactDraft, type Field } from './contact-import';

/** Tek seferde kabul edilen azami satır. Üstü tek işlemde tutulamaz. */
export const MAX_ROWS = 5000;

export type Outcome = 'created' | 'matched' | 'skipped';

export interface ImportRowResult {
  rowNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  outcome: Outcome;
  /** Yazıldıysa/eşleştiyse kişi kimliği; önizlemede eşleşmede dolu, yenide null. */
  contactId: string | null;
  matchedBy: 'e-posta' | 'telefon' | null;
  targetsAdded: number;
  issues: string[];
}

export interface ImportReport {
  dryRun: boolean;
  delimiter: string;
  mapping: Array<{ header: string; field: Field | null }>;
  /** Hiçbir alana eşlenemeyen başlıklar — yazım hatası buradan görünür. */
  unmappedHeaders: string[];
  summary: { total: number; created: number; matched: number; skipped: number; targets: number };
  rows: ImportRowResult[];
}

export interface RunOptions {
  defaultDialCode?: string;
  delimiter?: string;
  /** Bu dosyadakiler Müşteri mi Aday mı (003h). Varsayılan prospect. */
  lifecycle?: 'prospect' | 'customer';
}

@Injectable()
export class ContactImportService {
  private readonly logger = new Logger(ContactImportService.name);

  constructor(private readonly db: DatabaseService) {}

  async run(
    ctx: RequestContext, csv: string, opts: RunOptions, dryRun: boolean,
  ): Promise<ImportReport> {
    const text = (csv ?? '').trim();
    if (!text) throw new BadRequestException('Dosya boş.');

    const { parsed, drafts, unmappedHeaders, mapping } = draftsFromCsv(csv, opts);

    if (parsed.header.length === 0) {
      throw new BadRequestException('Başlık satırı okunamadı.');
    }
    if (drafts.length === 0) {
      throw new BadRequestException('Başlık dışında veri satırı yok.');
    }
    if (drafts.length > MAX_ROWS) {
      throw new BadRequestException(
        `Dosyada ${drafts.length} satır var; en çok ${MAX_ROWS} satır aktarılabilir. Dosyayı bölün.`,
      );
    }
    // Hiçbir kimlik kolonu tanınmadıysa aktarım anlamsız — büyük olasılıkla
    // ayırıcı yanlış seçilmiştir. Sessizce 0 kayıt yazmaktansa açıkça söyle.
    const known = new Set(mapping.map((m) => m.field));
    if (!known.has('firstName') && !known.has('fullName')
        && !known.has('email') && !known.has('phone')) {
      throw new BadRequestException(
        `Ad, e-posta veya telefon kolonu bulunamadı (ayırıcı "${parsed.delimiter}" seçildi). `
        + `Okunan başlıklar: ${parsed.header.join(' | ')}`,
      );
    }

    const rows = await this.db.withContext(ctx, async (c) => {
      const out: ImportRowResult[] = [];
      for (const d of drafts) {
        out.push(await this.processRow(c, ctx, d, dryRun, opts.lifecycle ?? 'prospect'));
      }
      // Burada ROLLBACK YOK ve gerek de yok: dryRun yolunda tek bir yazma
      // ifadesi çalışmaz (processRow yeni kayıtta erken döner, insertTargets
      // yalnız SELECT eder). withContext zaten BEGIN/COMMIT sarıyor; içeride
      // ROLLBACK çağırmak transaction'ı erken kapatıp SET LOCAL ile yazılan
      // RLS GUC'lerini düşürürdü.
      return out;
    });

    const summary = {
      total: rows.length,
      created: rows.filter((r) => r.outcome === 'created').length,
      matched: rows.filter((r) => r.outcome === 'matched').length,
      skipped: rows.filter((r) => r.outcome === 'skipped').length,
      targets: rows.reduce((s, r) => s + r.targetsAdded, 0),
    };

    if (!dryRun) {
      this.logger.log(
        `Kişi içe aktarımı: ${summary.created} yeni, ${summary.matched} eşleşen, `
        + `${summary.skipped} atlanan, ${summary.targets} yatırım hedefi.`,
      );
    }
    return {
      dryRun, delimiter: parsed.delimiter, mapping, unmappedHeaders, summary, rows,
    };
  }

  private async processRow(
    c: PoolClient, ctx: RequestContext, d: ContactDraft, dryRun: boolean,
    lifecycle: 'prospect' | 'customer',
  ): Promise<ImportRowResult> {
    const base = {
      rowNumber: d.rowNumber,
      name: [d.firstName, d.lastName].filter(Boolean).join(' ').trim() || '—',
      email: d.email,
      phone: d.phone,
      issues: d.issues,
    };

    if (d.skip) {
      return { ...base, outcome: 'skipped', contactId: null, matchedBy: null, targetsAdded: 0 };
    }

    const match = await this.findByIdentity(c, ctx, d);
    let contactId = match?.id ?? null;
    let outcome: Outcome = match ? 'matched' : 'created';

    if (!match) {
      if (dryRun) {
        // Yazmadan hedef sayısını yine de bildir: kullanıcı ne kazanacağını görsün.
        return {
          ...base, outcome, contactId: null, matchedBy: null,
          targetsAdded: d.targets.length,
        };
      }
      contactId = await this.insertContact(c, ctx, d, lifecycle);
    }

    const targetsAdded = contactId
      ? await this.insertTargets(c, ctx, contactId, d, dryRun)
      : 0;

    return {
      ...base, outcome, contactId,
      matchedBy: match?.matchedBy ?? null,
      targetsAdded,
    };
  }

  /** E-posta VEYA telefonla mevcut aktif kişi (repository ile aynı ilke). */
  private async findByIdentity(
    c: PoolClient, ctx: RequestContext, d: ContactDraft,
  ): Promise<{ id: string; matchedBy: 'e-posta' | 'telefon' } | null> {
    if (d.email) {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM contacts
          WHERE tenant_id = $1 AND lower(email) = $2
            AND deleted_at IS NULL AND merged_into_id IS NULL LIMIT 1`,
        [ctx.tenantId, d.email],
      );
      if (rows.length > 0) return { id: rows[0].id, matchedBy: 'e-posta' };
    }
    const digits = (d.phone ?? '').replace(/\D/g, '');
    if (digits) {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM contacts
          WHERE tenant_id = $1 AND normalized_phone = $2
            AND deleted_at IS NULL AND merged_into_id IS NULL LIMIT 1`,
        [ctx.tenantId, digits],
      );
      if (rows.length > 0) return { id: rows[0].id, matchedBy: 'telefon' };
    }
    return null;
  }

  private async insertContact(
    c: PoolClient, ctx: RequestContext, d: ContactDraft,
    lifecycle: 'prospect' | 'customer',
  ): Promise<string> {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO contacts
         (tenant_id, first_name, last_name, email, phone, whatsapp,
          preferred_lang, marketing_consent, consent_source, notes,
          lifecycle_stage, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7,'tr'), $8, $9, $10, $11, $12,$12)
       RETURNING id`,
      [ctx.tenantId, d.firstName, d.lastName, d.email, d.phone, d.whatsapp,
       d.lang, d.consent, d.consent ? 'import' : null, d.notes, lifecycle, ctx.userId],
    );
    const id = rows[0].id;

    const diff = { after: { id, first_name: d.firstName, email: d.email, phone: d.phone } };
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
       VALUES ($1,$2,'contact.imported','contact',$3,$4,$5)`,
      [ctx.tenantId, ctx.userId, id, JSON.stringify(diff), ctx.correlationId],
    );
    await c.query(
      `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
       VALUES ($1,'contact',$2,'contact.imported',$3,$4,$5)`,
      [ctx.tenantId, id, JSON.stringify(diff), ctx.correlationId, ctx.userId],
    );
    return id;
  }

  /** Yatırım hedeflerini yazar. Mevcut hedef EZİLMEZ (elle düzeltme korunur). */
  private async insertTargets(
    c: PoolClient, ctx: RequestContext, contactId: string, d: ContactDraft, dryRun: boolean,
  ): Promise<number> {
    if (d.targets.length === 0) return 0;
    if (dryRun) {
      // Eşleşen kişide hangi hedefin YENİ olduğunu göster; hepsini "eklenecek"
      // saymak eşleşen kayıtlarda yanıltıcı olurdu.
      const { rows } = await c.query<{ country_code: string; region: string | null }>(
        `SELECT country_code, region FROM investment_targets
          WHERE contact_id = $1 AND deleted_at IS NULL`,
        [contactId],
      );
      const have = new Set(rows.map((r) => `${r.country_code}|${r.region ?? ''}`));
      return d.targets.filter((t) => !have.has(`${t.countryCode}|${t.region ?? ''}`)).length;
    }

    let added = 0;
    for (const t of d.targets) {
      const { rowCount } = await c.query(
        `INSERT INTO investment_targets
           (tenant_id, contact_id, country_code, region, source, created_by, updated_by)
         VALUES ($1,$2,$3,$4,'import',$5,$5)
         ON CONFLICT DO NOTHING`,
        [ctx.tenantId, contactId, t.countryCode, t.region, ctx.userId],
      );
      added += rowCount ?? 0;
    }
    return added;
  }
}
