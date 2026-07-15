// =====================================================================
// PREI | CatalogRepository — Projects (properties) + Developers (organizations)
// salt-okuma sorguları. RLS bağlamında; developer adı join'lenir.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ProjectRow {
  id: string;
  developer_id: string | null;
  developer_name: string | null;
  title: string;
  city: string | null;
  district: string | null;
  country: string | null;
  price: string | null;
  currency: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

export interface DeveloperRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

const PROJECT_SELECT = `
  SELECT p.id, p.developer_id, org.name AS developer_name,
         p.title, p.city, p.district, p.country, p.price, p.currency,
         p.description, p.metadata, p.updated_at
    FROM properties p
    LEFT JOIN organizations org ON org.id = p.developer_id`;

@Injectable()
export class CatalogRepository {
  constructor(private readonly db: DatabaseService) {}

  async listProjects(ctx: RequestContext, limit = 100, offset = 0): Promise<ProjectRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProjectRow>(
        `${PROJECT_SELECT}
          WHERE p.deleted_at IS NULL
          ORDER BY p.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findProject(ctx: RequestContext, id: string): Promise<ProjectRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProjectRow>(
        `${PROJECT_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async createProject(
    ctx: RequestContext,
    input: {
      title: string;
      developerId: string | null;
      city: string | null;
      district: string | null;
      description: string | null;
      price: number | null;
      currency: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<ProjectRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO properties (tenant_id, developer_id, title, property_type, city, district, price, currency, description, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,'apartment',$4,$5,$6,$7,$8,$9,$10,$10)
         RETURNING id`,
        [
          ctx.tenantId, input.developerId, input.title, input.city, input.district,
          input.price, input.currency, input.description, JSON.stringify(input.metadata), ctx.userId,
        ],
      );
      const id = rows[0].id;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.created','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ title: input.title }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }

  async listDevelopers(ctx: RequestContext, limit = 100, offset = 0): Promise<DeveloperRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<DeveloperRow>(
        `SELECT id, name, phone, email, metadata, updated_at
           FROM organizations
          WHERE deleted_at IS NULL AND org_type = 'developer'
          ORDER BY name ASC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findDeveloper(ctx: RequestContext, id: string): Promise<DeveloperRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<DeveloperRow>(
        `SELECT id, name, phone, email, metadata, updated_at
           FROM organizations
          WHERE id = $1 AND deleted_at IS NULL AND org_type = 'developer'`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  /** Verilen geliştirici kimlikleri için tüm projeler — N+1 önler; JS'te gruplanır. */
  async projectsForDevelopers(ctx: RequestContext, devIds: string[]): Promise<ProjectRow[]> {
    if (devIds.length === 0) return [];
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProjectRow>(
        `${PROJECT_SELECT}
          WHERE p.deleted_at IS NULL AND p.developer_id = ANY($1::uuid[])
          ORDER BY p.updated_at DESC`,
        [devIds],
      );
      return rows;
    });
  }
}
