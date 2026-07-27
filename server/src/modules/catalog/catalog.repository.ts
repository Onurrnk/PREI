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

export interface ProjectDocRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string; // pg bigint → string
  related_id: string;
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

  /**
   * Projeden TEK bir görseli kaldırır.
   *
   * İki yerde duruyor: metadata.images (galeri) ve metadata.images_by_category
   * (kategorili gösterim). İkisinden de çıkarılmazsa silinen görsel bir
   * bölümde kalmaya devam ediyordu.
   */
  async removeProjectImage(
    ctx: RequestContext, id: string, url: string,
  ): Promise<ProjectRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE properties p
            SET metadata = jsonb_set(
                  jsonb_set(
                    p.metadata,
                    '{images}',
                    COALESCE((
                      SELECT jsonb_agg(v) FROM jsonb_array_elements(
                        COALESCE(p.metadata->'images', '[]'::jsonb)) v
                       WHERE v <> to_jsonb($2::text)
                    ), '[]'::jsonb)
                  ),
                  '{images_by_category}',
                  COALESCE((
                    SELECT jsonb_object_agg(
                             kv.key,
                             COALESCE((
                               SELECT jsonb_agg(v) FROM jsonb_array_elements(kv.value) v
                                WHERE v <> to_jsonb($2::text)
                             ), '[]'::jsonb))
                      FROM jsonb_each(
                        COALESCE(p.metadata->'images_by_category', '{}'::jsonb)) kv
                  ), '{}'::jsonb)
                ),
                updated_by = $3
          WHERE p.id = $1 AND p.deleted_at IS NULL
          RETURNING p.id`,
        [id, url, ctx.userId],
      );
      if (!rows[0]) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.image_removed','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ url }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }

  /** Projenin metadata.images dizisine yeni public URL'ler ekler. */
  async appendProjectImages(ctx: RequestContext, id: string, urls: string[]): Promise<ProjectRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE properties
            SET metadata = jsonb_set(metadata, '{images}',
                  COALESCE(metadata->'images', '[]'::jsonb) || $2::jsonb),
                updated_by = $3
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, JSON.stringify(urls), ctx.userId],
      );
      if (!rows[0]) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.images_added','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ count: urls.length }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }

  /** Proje yaşam döngüsü durumunu (metadata.lifecycle_status) değiştirir. */
  /** Proje tam-alan güncelleme: kolonlar COALESCE ile, metadata merge (|| ile
   *  yalnız verilen anahtarlar). deleted_at IS NULL koruması. */
  async updateProject(
    ctx: RequestContext,
    id: string,
    input: {
      title?: string | null;
      developerId?: string | null;
      city?: string | null;
      district?: string | null;
      description?: string | null;
      price?: number | null;
      currency?: string | null;
      metadataPatch?: Record<string, unknown>;
    },
  ): Promise<ProjectRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE properties SET
            title       = COALESCE($2, title),
            developer_id = COALESCE($3, developer_id),
            city        = COALESCE($4, city),
            district    = COALESCE($5, district),
            description = COALESCE($6, description),
            price       = COALESCE($7, price),
            currency    = COALESCE($8, currency),
            metadata    = COALESCE(metadata, '{}'::jsonb) || $9::jsonb,
            updated_by  = $10, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [
          id, input.title ?? null, input.developerId ?? null, input.city ?? null,
          input.district ?? null, input.description ?? null, input.price ?? null,
          input.currency ?? null, JSON.stringify(input.metadataPatch ?? {}), ctx.userId,
        ],
      );
      if (!rows[0]) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.updated','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ fields: Object.keys(input) }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }

  async setLifecycleStatus(ctx: RequestContext, id: string, status: string): Promise<ProjectRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE properties
            SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{lifecycle_status}', to_jsonb($2::text)),
                updated_by = $3, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, status, ctx.userId],
      );
      if (!rows[0]) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.lifecycle_changed','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ lifecycle_status: status }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }

  /**
   * Projeyi siler (soft delete — deleted_at). Test projesi/yanlış giriş
   * temizliği için. Liste ve detay deleted_at IS NULL filtresiyle çalıştığı
   * için proje her yerden düşer. Bulunamazsa false.
   */
  async deleteProject(ctx: RequestContext, id: string): Promise<boolean> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE properties SET deleted_at = now(), updated_by = $2, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      if (!rowCount) return false;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project.deleted','property',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ soft: true }), ctx.correlationId],
      );
      return true;
    });
  }

  /** Vault'a related_type='project' ile bağlanmış gerçek dosyalar. */
  async documentsByProjectIds(ctx: RequestContext, ids: string[]): Promise<ProjectDocRow[]> {
    if (ids.length === 0) return [];
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProjectDocRow>(
        `SELECT id, name, mime_type, size_bytes, related_id
           FROM documents_vault
          WHERE related_type = 'project' AND related_id = ANY($1) AND deleted_at IS NULL
          ORDER BY created_at DESC`,
        [ids],
      );
      return rows;
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

  async createDeveloper(
    ctx: RequestContext,
    input: { name: string; phone: string | null; email: string | null; metadata: Record<string, unknown> },
  ): Promise<DeveloperRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO organizations (tenant_id, name, org_type, phone, email, metadata, created_by, updated_by)
         VALUES ($1,$2,'developer',$3,$4,$5,$6,$6)
         RETURNING id`,
        [ctx.tenantId, input.name, input.phone, input.email, JSON.stringify(input.metadata), ctx.userId],
      );
      const id = rows[0].id;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'developer.created','organization',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ name: input.name }), ctx.correlationId],
      );
      const { rows: full } = await c.query<DeveloperRow>(
        `SELECT id, name, phone, email, metadata, updated_at FROM organizations WHERE id = $1`,
        [id],
      );
      return full[0];
    });
  }

  async updateDeveloper(
    ctx: RequestContext,
    id: string,
    input: { name: string | null; phone: string | null; email: string | null; metadataPatch: Record<string, unknown> },
  ): Promise<DeveloperRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<DeveloperRow>(
        `UPDATE organizations SET
           name     = COALESCE($2, name),
           phone    = COALESCE($3, phone),
           email    = COALESCE($4, email),
           metadata = metadata || $5::jsonb,
           updated_by = $6
         WHERE id = $1 AND deleted_at IS NULL AND org_type = 'developer'
         RETURNING id, name, phone, email, metadata, updated_at`,
        [id, input.name, input.phone, input.email, JSON.stringify(input.metadataPatch), ctx.userId],
      );
      const dev = rows[0] ?? null;
      if (dev) {
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
           VALUES ($1,$2,'developer.updated','organization',$3,$4,$5)`,
          [ctx.tenantId, ctx.userId, id, JSON.stringify(input.metadataPatch), ctx.correlationId],
        );
      }
      return dev;
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
