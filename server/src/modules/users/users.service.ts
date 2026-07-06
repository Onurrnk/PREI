// =====================================================================
// PREI | UsersService — ekip listesi. Servis principal'ları (@prei.system)
// hariç; rol user_roles→roles.key'den, avatar metadata veya üretilen URL.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  avatar: string | null;
}

export interface UserResponse {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext): Promise<UserResponse[]> {
    const rows = await this.db.withContext(ctx, async (c) => {
      const res = await c.query<UserRow>(
        `SELECT u.id, u.full_name, u.email,
                (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id LIMIT 1) AS role,
                u.metadata->>'avatar' AS avatar
           FROM users u
          WHERE u.deleted_at IS NULL AND u.is_active = true
            AND u.email NOT LIKE '%@prei.system'
          ORDER BY u.full_name ASC`,
      );
      return res.rows;
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.full_name,
      role: u.role ?? 'consultant',
      email: u.email,
      avatar: u.avatar
        ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=9B5BB3&color=fff`,
    }));
  }
}
