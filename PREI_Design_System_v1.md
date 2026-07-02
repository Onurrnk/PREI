# PREI Design System v1.0 — "Private Banking Terminal"

**Tarih:** 2026-07-02 · **Kapsam:** Tüm PREI ürün arayüzü (13 modül) + grafik/istatistik dili
**Hedef seviye:** 100M USD ürün algısı — Linear'ın disiplini × Bloomberg'in veri ciddiyeti × özel bankacılık estetiği
**Mod:** Redesign — Overhaul (görsel dil sıfırdan; bilgi mimarisi ve route'lar korunur)

> Master Plan'daki FAZ T'nin tasarım anayasasıdır. Bu dokümanda tanımlanmayan hiçbir renk, font, gölge veya animasyon UI'a giremez.

---

## 1. Mevcut Durum Denetimi (neden overhaul)

| Tespit | Sorun | Karar |
|---|---|---|
| `#9B5BB3` mor her yerde, sistemsiz | Renk logodan geliyor (✓ kalır — Onur kararı 2026-07-02) ama dekorasyon gibi savruk kullanılmış | → Mor **tek accent** olarak disiplinle: CTA, aktif durum, marka vurgusu. Dekorasyonda yasak |
| Inter (tek font) | Varsayılan AI fontu; veri/metin ayrımı yok | ❌ Geist + Geist Mono'ya geç |
| `John Doe`, `Jane Smith`, `Sarah` mock'ları | "Jane Doe etkisi" — demo bile ucuz görünüyor | ❌ Gerçekçi TR/Körfez/AB isimleriyle değiştir |
| Toplantı kartlarında rastgele hex (#3b82f6, #10b981, #8b5cf6) | Palet kilidi yok, sayfa içinde renk savrulması | ❌ Tek accent + semantik set |
| lucide-react | Proje bağımlılığı ama overhaul kapsamında | → Phosphor'a geçiş (tek aile kuralı) |
| Her şey Card içinde | Elevation hiyerarşi anlatmıyor | → Kart yalnız gerçek hiyerarşide; gruplama `border`/boşlukla |
| Grafik teması yok (recharts varsayılan) | Varsayılan recharts görünümü = ucuz | → §6 grafik dili zorunlu |

Korunanlar: bilgi mimarisi (13 modül, route slug'ları, nav yapısı), CSS Modules + custom properties yaklaşımı (Tailwind'e geçiş YOK — mevcut mimari sağlam), light/dark tema altyapısı (`data-theme`).

---

## 2. Kimlik Yönü

**"Private Banking Terminal"** — Dubai + İstanbul lüks gayrimenkul yatırımı yöneten bir yazılım; bir SaaS oyuncağı değil, bir servet yönetim aracı gibi hissettirmeli.

İlkeler:
1. **Koyu öncelikli.** Varsayılan tema koyu (gerçek off-black, saf siyah değil). Light tema ikincil ama tam destekli.
2. **Sayılar kutsal.** Para, yüzde, metrekare, tarih — tüm sayısal değerler mono fontta, tabular-nums ile. Sayı asla zıplamaz.
3. **Renk = anlam.** Accent dekorasyon değil; dikkat yönetimi aracı. Yeşil sadece pozitif, kırmızı sadece negatif/risk, marka moru sadece marka ve birincil aksiyon.
4. **Sessiz lüks.** Gradyan gösterisi, glow, neon yok. Derinlik; ince çizgiler, katman tonları ve tipografi ağırlığıyla kurulur.
5. **Hareket kanıttır.** Animasyon yalnız durum değişimini anlatır (yüklendi, güncellendi, sıralandı). Süs animasyonu yok.

---

## 3. Token Seti (variables.css'in yeni içeriği — tek doğruluk kaynağı)

```css
:root {
  /* ===== Marka (PREI logo paleti — Onur kararı: renkler logodan) ===== */
  --brand-primary:      #9B5BB3;   /* logo moru — CTA, aktif durum, marka vurgusu */
  --brand-primary-dim:  #8A4DA1;   /* hover/pressed */
  --brand-primary-soft: rgba(155, 91, 179, 0.14); /* seçili arkaplan, chip, focus ring */
  --brand-secondary:    #B89AC9;   /* lavanta — ikincil vurgu (logo alt yazısı vb.) */
  --on-brand:           #FFFFFF;   /* accent üstü metin — mor zeminde 4.6:1 AA */

  /* ===== Veri semantiği (yalnız veri için, dekorasyon için ASLA) ===== */
  --data-positive: #3FA372;   /* kazanç, artış, closed-won */
  --data-negative: #C2554F;   /* kayıp, düşüş, gecikme */
  --data-info:     #5B8DB8;   /* nötr bilgi, info durumu */
  --data-warning:  #C99441;   /* uyarı, yaklaşan vade */

  /* ===== Kategorik grafik rampası (8 renk, sıra sabit) ===== */
  --chart-1: #9B5BB3;  --chart-2: #5B8DB8;  --chart-3: #3FA372;  --chart-4: #B89AC9;
  --chart-5: #C2554F;  --chart-6: #4FA8A0;  --chart-7: #B8845B;  --chart-8: #7A8699;

  /* ===== Tipografi ===== */
  --font-sans: 'Geist', -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', 'SFMono-Regular', Consolas, monospace;

  --text-display: 600 1.75rem/1.2 var(--font-sans);   /* sayfa başlığı */
  --text-title:   600 1.125rem/1.35 var(--font-sans); /* bölüm/kart başlığı */
  --text-body:    400 0.875rem/1.55 var(--font-sans);
  --text-label:   500 0.75rem/1.3 var(--font-sans);   /* form etiketi, tablo başlığı */
  --text-metric:  500 1.625rem/1.1 var(--font-mono);  /* KPI değeri */
  --text-numeric: 450 0.8125rem/1.4 var(--font-mono); /* tablo içi sayılar */

  /* ===== Boşluk (8pt ızgara) ===== */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  /* ===== Radius kilidi: TEK sistem ===== */
  --radius-control: 8px;    /* buton, input, chip */
  --radius-surface: 12px;   /* kart, panel, modal */
  --radius-full: 9999px;    /* yalnız avatar ve durum noktası */

  /* ===== Motion ===== */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 140ms; --dur-base: 220ms; --dur-slow: 360ms;
}

/* ===== KOYU TEMA (varsayılan) ===== */
[data-theme='dark'] {
  --bg-app:            #0B0C0E;   /* saf siyah değil */
  --bg-surface:        #131418;
  --bg-surface-raised: #1A1C21;   /* modal, popover, hover katmanı */
  --bg-inset:          #08090A;   /* grafik zeminleri, input içi */

  --text-primary:   #ECEAE6;      /* saf beyaz değil — sıcak off-white */
  --text-secondary: #9C9A94;
  --text-muted:     #605F5B;

  --border-subtle:  rgba(236, 234, 230, 0.07);
  --border-strong:  rgba(236, 234, 230, 0.14);
  --border-focus:   var(--brand-primary);

  --shadow-raised: 0 8px 24px rgba(0, 0, 0, 0.4);
  --chart-grid: rgba(236, 234, 230, 0.06);   /* grafik kılavuz çizgileri */
}

/* ===== AÇIK TEMA ===== */
[data-theme='light'] {
  --bg-app:            #F4F3F1;
  --bg-surface:        #FDFCFB;
  --bg-surface-raised: #FFFFFF;
  --bg-inset:          #EDECE9;

  --text-primary:   #1B1A18;
  --text-secondary: #5C5A55;
  --text-muted:     #8E8C86;

  --border-subtle:  rgba(27, 26, 24, 0.08);
  --border-strong:  rgba(27, 26, 24, 0.16);
  --border-focus:   var(--brand-primary);

  --shadow-raised: 0 8px 24px rgba(27, 26, 24, 0.10);
  --chart-grid: rgba(27, 26, 24, 0.07);
}
```

Kurallar:
- **Saf `#000` ve `#FFF` yasak.** Nötrler hafif sıcak (kağıt/karbon hissi), accent'le uyumlu.
- **Gölge tek katman:** yalnız `--shadow-raised`, yalnız gerçekten yüzen öğelerde (modal, popover, dropdown). Kartlar gölgesiz — `border-subtle` ile ayrılır.
- Eski `--color-primary-purple` vb. token'lar bir geçiş haritasıyla (`purple → brand-primary`) alias'lanır, modüller taşındıkça alias'lar silinir.

---

## 4. Tipografi

| Kullanım | Font | Not |
|---|---|---|
| Arayüz metni, başlıklar | **Geist** (self-host, `font-display: swap`) | 400/500/600; 700 yasak (bağırma yok — hiyerarşi ağırlık+renk ile) |
| Tüm sayılar, para, tarih, ID | **Geist Mono** | `font-variant-numeric: tabular-nums` zorunlu; KPI'lar, tablo hücreleri, grafik eksenleri |
| Para formatı | — | `€1,240,500` değil `€1.24M` (kart/KPI); tabloda tam değer mono. TR ayracı i18n'e göre |

Google Fonts `<link>` yasak — fontlar `public/fonts/` altında self-host, `@font-face` ile.

---

## 5. Bileşen Kuralları

### 5.1 KPI Kartı (imza bileşen — Dashboard'un yapıtaşı)
Anatomi (yukarıdan aşağı): etiket (`--text-label`, `--text-secondary`) → değer (`--text-metric`, mono) → delta satırı (ok ikonu + mono yüzde, `--data-positive/negative`) → **sparkline** (28px yüksek, alan dolgusu %8 opaklık, çizgi 1.5px). Dört KPI yan yana, kartlar `--bg-surface` + `border-subtle`, gölgesiz.

### 5.2 Tablolar (Leads, Clients, Contracts, Financials)
- Satır ayracı: yalnız `border-bottom: 1px solid var(--border-subtle)` — asla üst+alt birlikte.
- Sayısal kolonlar sağa hizalı + mono. Durum kolonları renkli metin + hafif zemin chip'i (`--radius-control`), **renkli nokta yok**.
- Hover: `--bg-surface-raised` zemin, `--dur-fast`. Satır yüksekliği 44px (yoğun mod 36px).
- Sıralama/filtre başlıkta; skeleton loader tablo satırı şeklinde (spinner yok).

### 5.3 Durumlar (her modülde zorunlu üçlü)
- **Loading:** son layout'un iskeleti (shimmer, `--dur-slow` döngü — `prefers-reduced-motion`'da statik).
- **Empty:** tek ikon (Phosphor, duotone, 32px, `--text-muted`) + tek cümle + tek aksiyon butonu. İllüstrasyon yok.
- **Error:** inline (form) veya bölüm içi panel; toast yalnız geçici işlemler için.

### 5.4 Butonlar
- **Primary:** `--brand-primary` (logo moru) zemin, `--on-brand` beyaz metin — 4.6:1 AA. Sayfada tek primary.
- **Secondary:** şeffaf zemin + `border-strong`. **Ghost:** yalnız ikon-yanı metin.
- `:active` → `scale(0.98)`; etiketler tek satır, maks 3 kelime; aynı niyetli iki CTA yasak.

### 5.5 İkonlar
`@phosphor-icons/react` — tek aile. Varsayılan `weight="regular"`, boyut 16/20/24. Boş durumlarda `duotone`. lucide importları modül taşındıkça silinir; iki aile aynı ekranda görünmez (geçiş modül bazında tamamlanır).

---

## 6. Grafik & İstatistik Dili (imza zanaat yüzeyi)

Recharts korunur; tüm grafikler `src/core/charts/` altındaki tema sarmalayıcılarından geçer. **Çıplak recharts bileşeni feature kodunda yasak.**

### 6.1 Ortak kurallar
- **Izgara:** yalnız yatay hairline'lar, `--chart-grid` (≈%6 opaklık), dikey çizgi yok.
- **Eksenler:** çizgisiz (axisLine/tickLine false); tick'ler mono 11px `--text-muted`. Para eksenleri kısaltılmış (`1.2M`, `450K`).
- **Tooltip:** özel bileşen — `--bg-surface-raised`, `border-subtle`, `--radius-control`, `--shadow-raised`; başlık sans, değerler mono. Varsayılan recharts tooltip yasak.
- **Legend:** recharts legend kutusu yasak; seri adları grafik başlığının yanında renk çipli inline etiket.
- **Animasyon:** ilk mount'ta 600ms `--ease-out` çizim; veri güncellemesinde 300ms geçiş; `prefers-reduced-motion`'da kapalı.
- **Renk:** tek serili grafik = `--chart-1` (marka moru); karşılaştırma = rampa sırayla; pozitif/negatif ayrımı olan her seri semantik renkleri kullanır.

### 6.2 Grafik tipleri ve kullanım
| Tip | Nerede | İmza detay |
|---|---|---|
| **Area (gradyan)** | Gelir/pipeline trendi, Dashboard hero grafiği | Dolgu: seri renginden dikey gradyan %14 → %0; çizgi 2px; son noktada 4px dot + mono değer etiketi |
| **Sparkline** | KPI kartları, tablo satır içi mini trend | Eksensiz, tooltipsiz, 28px; tek renk |
| **Yatay bar** | Kampanya karşılaştırma (Meta Ads), kaynak kırılımı | Bar yüksekliği 12px, `--radius-control` uçlar; değer barın ucunda mono; arka plan track YASAK |
| **Donut** | Portföy dağılımı, pazar payı (TR/UAE) | Kalınlık 12px, merkezde toplam değer (`--text-metric`); pasta grafiği yasak |
| **Funnel (dikey adım)** | Reklam → lead → toplantı → kapanış (Faz 5) | Her adım yatay bar + adımlar arası dönüşüm yüzdesi mono küçük etiket |
| **Combo (bar+çizgi)** | Harcama (bar) vs CPL (çizgi) — Marketing | İki eksen; ikincil eksen tick'leri sağda, soluk |

### 6.3 Tema sarmalayıcı (uygulama deseni)
```tsx
// src/core/charts/theme.ts — tek kaynak
export const chartTheme = {
  grid:   { stroke: 'var(--chart-grid)', vertical: false },
  axis:   { stroke: 'transparent', tick: { fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' } },
  colors: ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)',
           'var(--chart-5)','var(--chart-6)','var(--chart-7)','var(--chart-8)'],
};
// Sarmalayıcılar: <TrendArea/>, <Sparkline/>, <HBarCompare/>, <DonutMetric/>, <FunnelSteps/>, <ComboSpend/>
```

---

## 7. Motion Sistemi (MOTION_INTENSITY: 4)

| An | Davranış |
|---|---|
| Sayfa geçişi | İçerik 8px yukarı kayarak fade-in, `--dur-base` |
| Liste yüklenmesi | Satırlar 40ms kademeli stagger (maks 8 satır, sonrası anında) |
| KPI değer değişimi | Mono sayı 300ms count-up (yalnız canlı güncellemede) |
| Modal/popover | Scale 0.98→1 + fade, `--dur-fast` |
| Grafik | §6.1 kuralları |

Yasak: sonsuz döngü animasyonlar, parallax, scroll-hijack, hover'da zıplayan kartlar, `window.addEventListener('scroll')`. Tümü `prefers-reduced-motion` ile statiğe düşer.

---

## 8. Uygulama Sırası (FAZ T iç planı)

| Adım | İş | Çıktı |
|---|---|---|
| T1 | Token katmanı: `variables.css` yeniden yazımı + font self-host + alias haritası | Tüm app yeni nötrlerle açılır (accent'ler henüz karışık olabilir) |
| T2 | Core bileşenler: Button, Card, Table, Modal, Toast, Sidebar, Topbar + Phosphor geçişi (core) | Kabuk %100 yeni dil |
| T3 | `src/core/charts/` tema sarmalayıcıları + Dashboard overhaul (Komuta Merkezi v0: KPI kartları + hero trend grafiği) | İmza ekran hazır — kalite çıtası burada belirlenir |
| T4 | Veri modülleri: Leads → Clients → Financials → Contracts (tablolar + durumlar) | |
| T5 | Kalan modüller: Projects, Developers, Proposals, Documents, Meetings, Tasks, Admin, Settings, Login | |
| T6 | Mock veri temizliği (gerçekçi isimler/sayılar) + iki temada tam tur QA + kontrast denetimi | Ship |

## 9. Kabul Kriterleri (FAZ T çıkışı) — Denetim: 2026-07-02

- [x] Altın/şampanya (#C6A15B) kod tabanında sıfır geçiyor; tek accent = logo moru (#9B5BB3). *(grep: 0 sonuç)*
- [x] Sayısal değerler Geist Mono + tabular-nums — KPI'lar, tablo para/ID/oran kolonları, grafik eksenleri. *(inspect ile ölçüldü)*
- [x] Feature kodunda çıplak recharts importu sıfır; tüm grafikler `core/charts`'tan. *(grep: 0 dosya)*
- [~] Loading (TableSkeleton) ana liste modüllerinde ✅; **empty/error durumları henüz evrensel değil** — Faz 1'de her modül gerçek API'ye bağlanırken tamamlanacak (bilinçli erteleme; gerçek hata/boş senaryoları API ile birlikte anlam kazanıyor).
- [x] Radius kilidi: 13 chip/pill `radius-control`'a çekildi; `radius-full` yalnız avatar, bildirim noktası, scrollbar. *(satır satır denetlendi)*
- [x] İki temada AA kontrast: aktif nav 4.62, muted metin koyu 4.94 / açık 4.73, primary buton 4.6, form 15.7. **Denetim 2 ihlal yakaladı ve düzeltildi:** buton beyaz-üstü-şampanya (T1'de) ve `--text-muted` her iki temada (T6'da).
- [x] Tek ikon ailesi: lucide-react **paketten kaldırıldı**; yalnız Phosphor.
- [x] Mock isimler: "John Doe / Jane Smith / Jane Agent / Acme Corp" sıfır; çok pazarlı gerçekçi isimler (TR/UAE/ES/UK/DE).
- [x] `prefers-reduced-motion`: global CSS kill-switch + skeleton shimmer + recharts `MOTION_OK` guard'ı.
- [ ] **Açık kalem (B-14):** 390px mobil tur — Faz 1 PWA çalışmasıyla birlikte.

**FAZ T durumu: KAPANDI** (2 açık kalem Faz 1'e devredildi, gerekçeleri yukarıda). Görsel dil donduruldu; bundan sonra UI değişiklikleri bu dokümana uygunluk denetiminden geçer.
