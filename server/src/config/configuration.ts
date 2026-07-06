// =====================================================================
// PREI | Backend configuration (env-driven)
// All secrets come from environment variables — never hard-coded.
// =====================================================================
export interface AppConfig {
  port: number;
  frontendUrl: string;
  database: {
    // Postgres bağlantı stringi. Üretimde RLS'in AKTİF kalması için
    // NOBYPASSRLS bir role (ör. prei_app) işaret etmeli — service_role/postgres
    // DEĞİL. Servis katmanı ayrıca tenant_id ile scope'lar (belt & suspenders).
    url: string;
    ssl: boolean;
  };
  supabase: {
    // Proje URL'i (token uzaktan doğrulama /auth/v1/user için).
    url: string;
    // anon/publishable key — uzaktan doğrulama çağrısının apikey header'ı.
    anonKey: string;
    // Legacy HS256 shared secret (opsiyonel; verilirse hızlı lokal doğrulama).
    jwtSecret: string;
    // Tek tenant operasyonu: varsayılan tenant slug (Onur onayına kadar).
    defaultTenantSlug: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL ?? '',
    ssl: (process.env.DATABASE_SSL ?? 'true') !== 'false',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? 'https://kkcvfvbjmohlplepadip.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? 'produality',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/auth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
  },
});
