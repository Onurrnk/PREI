// =====================================================================
// PREI | EylulBrainService — DM'lere cevap üretir.
//
// Akış: konuşma geçmişi (PREI) + bilgi bankası (pgvector match_documents)
// → persona/kurallar (tek kaynak) → OpenAI sohbet tamamlama → dolgu temizliği.
//
// n8n'deki Telegram akışının BEYNİNİN aynısı; fark yalnız taşıma katmanı.
// Persona metni ortak olduğu için iki kanal aynı sesle konuşur.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { EYLUL_PERSONA, EYLUL_RULES } from './eylul-persona';
import { buildPrompt, detectLang, stripFiller, toPlainText, type ChatMessage } from './eylul-brain';

const OPENAI = 'https://api.openai.com/v1';
const HISTORY_LIMIT = 12;
const RAG_MATCHES = 5;

export interface RespondInput {
  leadId: string;
  contactId: string;
  message: string;
  channel: string;
}

@Injectable()
export class EylulBrainService {
  private readonly logger = new Logger(EylulBrainService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Cevabı üretir. Anahtar yoksa veya OpenAI hata verirse null (sessiz kal). */
  async respond(ctx: RequestContext, input: RespondInput): Promise<string | null> {
    const { apiKey } = this.config.get('openai', { infer: true });
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY yok — DM cevabı üretilemedi.');
      return null;
    }

    const [history, contactName] = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ direction: 'inbound' | 'outbound'; body: string }>(
        `SELECT direction, body FROM communications
          WHERE tenant_id = $1 AND lead_id = $2 AND body IS NOT NULL AND body <> ''
          ORDER BY created_at DESC LIMIT $3`,
        [ctx.tenantId, input.leadId, HISTORY_LIMIT + 1],
      );
      const { rows: ct } = await c.query<{ name: string | null }>(
        `SELECT NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), '') AS name
           FROM contacts WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, input.contactId],
      );
      return [rows, ct[0]?.name ?? null] as const;
    });

    // En yenisi az önce yazdığımız mesajın kendisi — onu geçmişten çıkar.
    const prior = history
      .slice(1)
      .reverse()
      .map((h) => ({ direction: h.direction, body: h.body }));

    const knowledgeText = await this.retrieve(ctx, input.message);
    const messages = buildPrompt({
      persona: EYLUL_PERSONA,
      rules: EYLUL_RULES,
      knowledgeText,
      replyLang: detectLang(input.message),
      history: prior,
      message: input.message,
      contactName,
    });

    const raw = await this.complete(messages);
    if (!raw) return null;
    const clean = stripFiller(toPlainText(raw));
    return clean || null;
  }

  /**
   * Bilgi bankası araması: mesajı gömer, en yakın pasajları metne çevirir.
   *
   * withContext (prei_app) ŞART — db.raw() prei_bootstrap rolünü kullanır ve
   * o rolün documents tablosunda GRANT'i yoktur ("permission denied").
   * AgentService.searchKnowledge de aynı yolu kullanıyor.
   */
  private async retrieve(ctx: RequestContext, query: string): Promise<string> {
    const embedding = await this.embed(query);
    if (!embedding) return '';
    try {
      return await this.db.withContext(ctx, async (c) => {
        const { rows } = await c.query<{ content: string }>(
          `SELECT content FROM match_documents($1::vector, $2, '{}'::jsonb)`,
          [`[${embedding.join(',')}]`, RAG_MATCHES],
        );
        return rows.map((r) => r.content).join('\n\n---\n\n');
      });
    } catch (e) {
      this.logger.warn(`Bilgi bankası araması başarısız: ${(e as Error).message}`);
      return '';
    }
  }

  private async embed(text: string): Promise<number[] | null> {
    const { apiKey, embedModel } = this.config.get('openai', { infer: true });
    try {
      const res = await fetch(`${OPENAI}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: embedModel, input: text }),
      });
      const json = (await res.json()) as { data?: Array<{ embedding: number[] }>; error?: { message?: string } };
      if (!res.ok || !json.data?.[0]) {
        this.logger.warn(`Gömme başarısız: ${json.error?.message ?? res.status}`);
        return null;
      }
      return json.data[0].embedding;
    } catch (e) {
      this.logger.warn(`Gömme ağ hatası: ${(e as Error).message}`);
      return null;
    }
  }

  private async complete(messages: ChatMessage[]): Promise<string | null> {
    const { apiKey, chatModel } = this.config.get('openai', { infer: true });
    try {
      const res = await fetch(`${OPENAI}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: chatModel,
          messages,
          temperature: 0.7,
          max_tokens: 400, // DM ritmi: 2-4 cümle; uzun rapor değil
        }),
      });
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (!res.ok || !json.choices?.[0]?.message?.content) {
        this.logger.warn(`Cevap üretilemedi: ${json.error?.message ?? res.status}`);
        return null;
      }
      return json.choices[0].message.content;
    } catch (e) {
      this.logger.warn(`OpenAI ağ hatası: ${(e as Error).message}`);
      return null;
    }
  }
}
