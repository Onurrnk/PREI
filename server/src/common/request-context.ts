// =====================================================================
// PREI | RequestContext — her istek için taşınan güvenlik+izleme bağlamı
// tenant_id/user_id/role → DB GUC'lerine yazılır (RLS aktive olur).
// correlationId → UI→API→DB→audit zincirini tek ID ile bağlar (F10).
// =====================================================================
export type AppRole =
  | 'super_admin'
  | 'manager'
  | 'finance_manager'
  | 'marketing_manager'
  | 'consultant'
  | 'service_agent';

export interface RequestContext {
  correlationId: string;
  tenantId: string | null;
  userId: string | null;
  role: AppRole | null;
  /** Kimliği doğrulanmış principal var mı (agent veya kullanıcı) */
  authenticated: boolean;
}

/** Express Request'e iliştirilen alan adı */
export const CTX_KEY = 'preiContext' as const;

export interface WithContext {
  [CTX_KEY]?: RequestContext;
}
