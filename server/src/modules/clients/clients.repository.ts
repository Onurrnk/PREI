// =====================================================================
// PREI | ClientsRepository — müşteri dizini (contacts üstünde, salt-okuma).
// Yatırım aggregate'leri deals(status='won')'dan EUR bazında (fx_to_eur);
// consultant = lead owner; son temas = communications. Müşteriye özgü alanlar
// (uyruk/tip/profil/bölge/statü) metadata jsonb'da (operasyonla dolar).
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ClientRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  total_investment_eur: string | null;
  active_properties: number;
  consultant: string | null;
  last_contact: string | null;
}

// SELECT gövdesi (WHERE hariç) — list/detail kendi WHERE'ini ekler.
const CLIENT_SELECT = `
  SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.metadata, c.updated_at,
         COALESCE((SELECT SUM(fx.amount_eur)
            FROM deals d JOIN leads l ON l.id = d.lead_id
            LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
            WHERE l.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'won'), 0) AS total_investment_eur,
         (SELECT count(*)::int FROM deals d JOIN leads l ON l.id = d.lead_id
            WHERE l.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'won') AS active_properties,
         (SELECT u.full_name FROM leads l JOIN users u ON u.id = l.owner_id
            WHERE l.contact_id = c.id AND l.owner_id IS NOT NULL
            ORDER BY l.created_at DESC LIMIT 1) AS consultant,
         (SELECT max(cm.sent_at) FROM communications cm WHERE cm.contact_id = c.id) AS last_contact
    FROM contacts c`;

@Injectable()
export class ClientsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, limit = 200, offset = 0): Promise<ClientRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ClientRow>(
        `${CLIENT_SELECT}
          WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL
          ORDER BY c.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<ClientRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ClientRow>(
        `${CLIENT_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }
}
