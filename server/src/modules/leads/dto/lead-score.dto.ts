// =====================================================================
// PREI | LeadScoreResponse — lead_scores tablosundan salt-okuma (skor geçmişi).
// =====================================================================
import type { LeadScoreRow } from '../leads.repository';

export interface LeadScoreResponse {
  id: string;
  score: number;
  reasoning: string | null;
  signals: Record<string, unknown>;
  source: 'manual' | 'n8n_ai';
  createdAt: string;
  createdBy: string | null;
}

export function toLeadScoreResponse(row: LeadScoreRow): LeadScoreResponse {
  return {
    id: row.id,
    score: row.score,
    reasoning: row.reasoning ?? null,
    signals: row.signals ?? {},
    source: row.source as 'manual' | 'n8n_ai',
    createdAt: row.created_at,
    createdBy: row.created_by_name ?? null,
  };
}
