// =====================================================================
// PREI | Bilgi bankası eleme — saf mantık (DB'siz, test edilebilir).
//
// NEDEN VAR (ölçüldü 2026-08-04): Bilgi bankasında Eylül'ün KENDİ ÇALIŞMA
// KILAVUZU duruyor — "Danışmanca Keşif ve Randevu Yönlendirme", "İtiraz
// Giderme Kütüphanesi", "Satış İletişim Rehberi", guardrail dosyaları.
// Kullanıcı sohbetle ilgili bir şey sorunca ("toplantıdan önce bilgi almak
// istiyorum") bu belgeler en üste çıkıyor, çünkü metinleri tam da sohbet
// HAKKINDA. Eylül de kendi senaryosunu okuyup uyguluyor: "Aşama 1 —
// Karşılama ve Kayıt (önce kişi)" görünce adı/telefonu YENİDEN soruyor,
// "Aşama 7 — Randevuya Yönlendirme" görünce Calendly atıyor.
//
// Gerçek konuşmada gözlenen tam olarak buydu: aynı soruları tekrarlaması,
// randevuya itmesi ve hiç bilgi vermemesi.
//
// Bu belgeler ZATEN persona/prompt içinde. Cevap malzemesi olarak ikinci
// kez verilmeleri yalnız zarar veriyor.
// =====================================================================

/**
 * Cevap üretiminde KULLANILMAYACAK kategoriler: Eylül'ün kendi işleyiş
 * dokümanları. Müşteriye anlatılacak bilgi değil, ajanın talimatı.
 *
 * KASITLI OLARAK DIŞARIDA BIRAKILANLAR (yani elenmeyenler):
 *   · process  → "Türkiye Gayrimenkul Müşteri Süreci", "Tapu Devir Süreci"
 *                — yatırımcının gerçekten sorduğu şeyler
 *   · taxonomy → ülke bazlı yatırım/vatandaşlık/vergi rehberleri
 * Bu ikisi süreç anlatır ama MÜŞTERİYE anlatır; ajana değil.
 */
export const META_CATEGORIES = new Set([
  'script',              // keşif/randevu senaryoları, itiraz kütüphanesi
  'sales_communication', // satış iletişim rehberi
  'brand_voice',         // ses tonu rehberi
  'policy',              // guardrail / sorumluluk reddi kuralları
  'automation',          // iç otomasyon sistemleri dokümantasyonu
]);

/** Bir pasaj müşteriye cevap malzemesi olarak kullanılabilir mi. */
export function isAnswerableChunk(
  chunk: { metadata?: Record<string, unknown> | null },
): boolean {
  const cat = chunk.metadata?.category;
  return typeof cat === 'string' ? !META_CATEGORIES.has(cat) : true;
}
