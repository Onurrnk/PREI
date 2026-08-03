// =====================================================================
// PREI | Entegrasyon sağlayıcı kayıt defteri — saf veri + saf mantık.
//
// NEDEN VAR: Bugüne kadar her entegrasyon sıfırdan yazıldı. Google için
// imzalı state'li düzgün bir OAuth akışı var; Meta ortam değişkeninde
// (kullanıcı bağlayamıyor, tek hesaba kilitli); Instagram/YouTube için
// üçüncü, dördüncü bir yol açılacaktı. Her seferinde aynı işi yapmak
// hem yavaş hem hataya açık.
//
// Buradan sonra yeni platform eklemek = bu dosyaya BİR KAYIT + varsa
// hesap etiketini okuyan küçük bir adaptör. Rotalar, depolama, durum
// gösterimi ve arayüz kartı kendiliğinden gelir.
//
// KAPSAM AYRIMI (scope) bilinçli:
//   'user'   → kişisel hesap (Gmail kutusu). Danışman ayrılınca gitmeli.
//   'tenant' → şirket varlığı (reklam hesabı, kurumsal sayfa). Kalmalı.
// =====================================================================

export type ProviderScope = 'user' | 'tenant';

export interface ProviderDef {
  /** Kararlı kimlik — veritabanında ve URL'de bu geçer. */
  id: string;
  /** Arayüzde görünen ad. */
  label: string;
  /** Ne işe yaradığı — arayüz kartında tek satır. */
  description: { tr: string; en: string };
  scope: ProviderScope;
  /** OAuth uçları. authUrl boşsa bu sağlayıcı henüz bağlanamaz. */
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Sağlayıcının ek yetkilendirme parametreleri (Google için offline vb.). */
  extraAuthParams?: Record<string, string>;
  /**
   * Hazır mı? false ise arayüzde "yakında" olarak görünür ve bağlan
   * butonu çalışmaz. Dürüst olmak için: bugün Meta App Review, Google
   * doğrulaması gibi DIŞ engeller var; bunları "çalışıyor" gibi
   * göstermek kullanıcıyı boşuna uğraştırır.
   */
  available: boolean;
  /** Neden hazır değil — arayüzde ipucu olarak gösterilir. */
  blockedReason?: { tr: string; en: string };
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'google',
    label: 'Google (Gmail + Takvim)',
    description: {
      tr: 'Kendi Gmail kutunuzdan mail gönderin, takviminizi senkronize edin.',
      en: 'Send mail from your own Gmail, sync your calendar.',
    },
    scope: 'user',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'openid', 'email', 'profile',
    ],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    available: true,
  },
  {
    id: 'meta_ads',
    label: 'Meta Reklamlar',
    description: {
      tr: 'Facebook/Instagram reklam harcaması ve dönüşüm verisi.',
      en: 'Facebook/Instagram ad spend and conversion data.',
    },
    scope: 'tenant',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['ads_read', 'business_management'],
    available: false,
    blockedReason: {
      tr: 'Meta App Review onayı bekleniyor.',
      en: 'Awaiting Meta App Review approval.',
    },
  },
  {
    id: 'instagram',
    label: 'Instagram (İş Hesabı)',
    description: {
      tr: 'Gelen DM’leri PREI’de yanıtlayın, gönderi performansını görün.',
      en: 'Answer DMs inside PREI, see post performance.',
    },
    scope: 'tenant',
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_manage_messages', 'pages_show_list', 'pages_manage_metadata'],
    available: false,
    blockedReason: {
      tr: 'Meta App Review ve Facebook Sayfası bağlantısı gerekiyor.',
      en: 'Requires Meta App Review and a linked Facebook Page.',
    },
  },
  {
    id: 'youtube',
    label: 'YouTube',
    description: {
      tr: 'Kanal videolarını ve izlenme verisini PREI’ye getirin.',
      en: 'Bring channel videos and view data into PREI.',
    },
    scope: 'tenant',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    available: false,
    blockedReason: {
      tr: 'Google doğrulaması tamamlanınca açılacak.',
      en: 'Opens once Google verification completes.',
    },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn (Şirket Sayfası)',
    description: {
      tr: 'Şirket sayfası gönderileri ve etkileşim verisi.',
      en: 'Company page posts and engagement data.',
    },
    scope: 'tenant',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_organization_social', 'w_organization_social'],
    available: false,
    blockedReason: {
      // Bu diğerlerinden farklı: LinkedIn erişimi seçtiği partnerlere veriyor.
      // Süre değil, ONAY meselesi — vaat etmemek için ayrıca yazıldı.
      tr: 'LinkedIn Community Management API erişimi partner başvurusu gerektiriyor; onay garanti değil.',
      en: 'LinkedIn Community Management API access requires partner approval; not guaranteed.',
    },
  },
];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export const providerById = (id: string | null | undefined): ProviderDef | null =>
  (id ? BY_ID.get(id) ?? null : null);

/** Bağlanabilir sağlayıcılar — arayüzde "Bağlan" butonu aktif olanlar. */
export const availableProviders = (): ProviderDef[] => PROVIDERS.filter((p) => p.available);

/**
 * Yetkilendirme adresini kurar.
 *
 * `state` BURADA üretilmez, çağıran taraf imzalayıp verir: imzasız state
 * CSRF açığıdır. Google akışında zaten HMAC'li state kullanılıyor, aynı
 * ilke korunuyor.
 */
export function buildAuthUrl(args: {
  provider: ProviderDef;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const { provider, clientId, redirectUri, state } = args;
  if (!provider.authUrl) throw new Error(`${provider.id}: authUrl tanımsız`);
  if (!clientId) throw new Error(`${provider.id}: client id yapılandırılmamış`);
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    ...(provider.extraAuthParams ?? {}),
  });
  return `${provider.authUrl}?${p.toString()}`;
}
