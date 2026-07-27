// =====================================================================
// PREI | AI sağlayıcı hatalarını kullanıcıya dönük mesaja çevirir.
//
// Neden: Anthropic/OpenAI SDK'ları hata mesajı olarak ham JSON döndürüyor
// ("400 {"type":"error",...credit balance too low...}"). Bu, catch bloğunda
// doğrudan `message` alanına konup ekrana dökülüyordu — kullanıcı teknik
// çöp görüyor. Bu yardımcı, tanınan hata sınıflarını Türkçe, anlaşılır ve
// eyleme dönük mesaja çevirir; tanınmayanı da ham JSON yerine genel mesaja.
// =====================================================================

/** Ham AI hatasını kullanıcıya gösterilebilir Türkçe mesaja çevirir. */
export function friendlyAiError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();

  // Anthropic/OpenAI kredi/bakiye
  if (raw.includes('credit balance') || raw.includes('insufficient_quota')
      || raw.includes('billing') || raw.includes('payment')) {
    return 'AI motoru için hesap bakiyesi yetersiz. Sağlayıcı panelinden (Anthropic/OpenAI) kredi yükleyin; yükleme sonrası otomatik çalışır.';
  }
  // Kota / hız sınırı (429)
  if (raw.includes('rate limit') || raw.includes('429') || raw.includes('quota')
      || raw.includes('overloaded')) {
    return 'AI motoru şu an yoğun (kota/hız sınırı). Birkaç dakika sonra tekrar deneyin.';
  }
  // Geçersiz/eksik anahtar (401)
  if (raw.includes('invalid_api_key') || raw.includes('invalid x-api-key')
      || raw.includes('authentication') || raw.includes('401') || raw.includes('unauthorized')) {
    return 'AI anahtarı geçersiz ya da eksik. Yönetici anahtarı kontrol etmeli.';
  }
  // Ağ / zaman aşımı
  if (raw.includes('timeout') || raw.includes('econnreset') || raw.includes('enotfound')
      || raw.includes('network') || raw.includes('fetch failed')) {
    return 'AI motoruna ulaşılamadı (ağ hatası). Bağlantıyı kontrol edip tekrar deneyin.';
  }
  // Tanınmayan: ham JSON'u SIZDIRMA — genel mesaj.
  return 'AI motoru şu an yanıt veremedi. Sorun sürerse yöneticiye bildirin.';
}
