# PREI — Otomatik Proje Girişi (Geliştirici Portalı) · Plan v1.1

**Durum:** Planlama (henüz uygulanmadı). "Başla" dediğinde Faz 1'den başlanır.
**Tarih:** 2026-07-19 · **Sahip:** Onur
**v1.1 notu:** Onur'la istişare sonrası ek maddeler eklendi (geliştirici kimliği,
link yönetimi, güncelleme/yeniden onay, mükerrer kontrol, mail inceliği, eşleşme
kuralı, AI ön-kontrol, yaşam döngüsü). İki varsayılan karar aşağıda işaretli.

## Amaç
Yeni projeleri PREI'ye elle girmek yerine, **geliştiriciler kendileri** girsin
(form + PDF broşür + görseller + fiyat + komisyon + daire tipleri); sistem
doğrulayıp **onaya** sunsun. Onaylanan proje kataloğa aktif girer ve **kriteri
uyan** müşterilere markalı "yeni proje" maili gider.

## Kilitlenen kararlar
1. **Onay kuyruğu** — dış veri önce taslak; Onur tek tıkla onaylayınca aktifleşir.
2. **Önce geliştirici linki** — yapılandırılmış form; e-posta intake sonraki faz.
3. **Kriter-eşleşmeli bildirim** — yalnız bölge/daire tipi/bütçe uyan +
   `marketing_consent` izinli müşterilere (KVKK).
4. **[Varsayılan]** Davet linki: geliştirici başına **çok kullanımlık + süreli +
   iptal edilebilir**. Her gönderim yine onaydan geçer. *(değiştirilebilir)*
5. **[Varsayılan]** Aynı gün çok proje onaylanırsa müşteriye **tek özet mail**
   (günlük digest), proje başına ayrı değil. *(değiştirilebilir)*

## Akış (geliştirici portalı)
1. Onur PREI'de bir **davet linki** üretir → **bir geliştirici kaydına bağlı**
   (developers modülü), süreli, tokenli, iptal edilebilir URL.
2. Geliştirici linki açar (giriş gerekmez) → **form doldurur:**
   - Proje adı, konum (ülke/şehir/bölge) — geliştirici linkten belli
   - Fiyat aralığı (min ≤ max + para birimi)
   - **Komisyon oranı (%)** — geliştiricinin beyanı; onayda teyit edilir
   - Daire tipleri (1+1, 2+1, villa…) + opsiyonel tip başına fiyat/alan
   - Teslim tarihi, açıklama
   - **PDF broşür** (zorunlu) + **görseller** (en az 1)
3. Sistem **doğrular** → **taslak proje** (`status='pending_review'`) kaydeder,
   geliştiriciye "aldık, inceleniyor" bildirir, Onur'a haber verir (Telegram/mail).
4. Onur **Onay Kuyruğu**'nda önizler → **Onayla** / **Reddet**.
5. Onaylanınca: proje kataloğa aktif girer + geliştiriciye "projeniz yayında" +
   kriter-eşleşmeli müşteri (özet) maili çıkar.

## Zaten hazır (yeniden kullanılacak)
Projeler + görsel yükleme uçları · PDF/görsel için Storage · **developers modülü** ·
markalı e-posta altyapısı (welcome/weekly + marka sesi rehberi) · n8n · müşteri
kartındaki bölge/daire tipi/bütçe kriterleri.

## Yeni kurulacak
Tokenli public form sayfası · **geliştirici-bağlı davet-token** (üret/süre/iptal/
yeniden gönder) · projelere durum alanı (taslak/aktif/red) + komisyon/fiyat aralığı ·
onay kuyruğu ekranı (önizleme) · kriter-eşleşme sorgusu + özet bildirim maili.

## Doğrulama kuralları
Komisyon 0–100 arası · fiyat min ≤ max · para birimi seçimi · **broşür (PDF)
zorunlu, en az 1 görsel** · dosya tipi (yalnız PDF/görsel) + boyut sınırı.

## Güvenlik / gizlilik
Public sayfa yalnız geçerli token'la (süreli + rate-limited + iptal edilebilir) ·
**komisyon gizliliği (G-1) taslakta da geçerli** · müşteri mailinde komisyon ASLA
görünmez · toplu mail yalnız izinli + eşleşen müşteriye, **abonelikten çık** linkiyle,
müşterinin **diline (TR/EN)** göre.

## Eşleşme kuralı (Faz 2)
"Uyan müşteri" = bölge ∩ + daire tipi ∩ + (bütçe, proje fiyat aralığında). Bölge
adları serbest metin (Türkiye / İstanbul / Kadıköy) olduğundan eşleşme esnek olmalı.
Kriteri hiç olmayan müşteri "eşleşen" listesine girmez.

## Fazlar
- **Faz 1 (MVP):** geliştirici-bağlı davet linki → form (alanlar + PDF + görsel +
  doğrulama) → taslak → onay kuyruğu (önizleme) → onayla/reddet → aktif +
  geliştiriciye durum bildirimi.
- **Faz 1.5:** **Güncelleme & yeniden onay** — fiyat/müsaitlik/broşür değişince
  geliştirici aynı linkten günceller → tekrar onaya düşer. (Atlanırsa katalog bayatlar.)
- **Faz 2:** kriter-eşleşmeli **özet** müşteri maili + **mükerrer kontrol**
  (ad+geliştirici+konum) + dil/abonelik/komisyon-gizli kuralları.
- **Faz 3:** e-posta intake (`info@`) → LLM taslak → aynı onay kuyruğu.
  *("kolay görünen zor" — ayrıştırma kırılgan; onaylı-taslak şart.)*
- **Sonraki:** onay kuyruğunda **AI ön-kontrol** (eksik görsel / tuhaf komisyon /
  boş alan işaretle) · **proje yaşam döngüsü** (satıldı/kaldırıldı/duraklat →
  katalogdan düşme, istersen "son fırsat" bildirimi).

## Uygulama zamanı Onur'dan gerekecekler
Submit sayfası adresi (`prei.produality.com/submit/<token>` mı, ayrı mı) ·
zorunlu alan listesi kesinleşmesi · bot koruması tercihi · mail tonu (marka sesi
rehberi kullanılır).

## Dürüst efor
Geliştirici portalı orta zorlukta ama **sağlam** — altyapı büyük ölçüde var.
Tam-otomatik e-posta→aktif kısmı bilinçli olarak Faz 3'e + onaylı-taslağa alındı.
