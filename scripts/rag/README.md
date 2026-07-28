# RAG'a künyeli rapor ekleme

Dış araştırma raporlarını (PDF/XLSX) Eylül'ün bilgi bankasına ekler.
Her parça **künye** taşır: yayıncı, başlık, yayın tarihi, ülke, sayfa.
Künyeyi modele gösteren kod: `server/src/modules/agent/provenance.ts`
(6 aydan eski doğrulamada "⚠ N ay önce doğrulandı, teyit et" uyarısı basar).

## Neden üç parça hâlinde

| Adım | Nerede | Neden |
|---|---|---|
| `extract.mjs` / `extract-dld.mjs` | yerel | PDF'ler yerel diskte |
| `embed.mjs` | `prei-backend` konteyneri | `OPENAI_API_KEY` orada, yerelde değil |
| `docs.sql` | `supabase-db` konteyneri (DB host) | RLS'i aşmak için `postgres` rolü |

Backend (204.168.178.96) ve DB (157.180.120.75) **ayrı makineler**.

## Çalıştırma

```bash
# 1) Yerelde çıkar (unpdf + exceljs gerekir)
node scripts/rag/extract.mjs          # → chunks.json      (piyasa raporları)
node scripts/rag/extract-dld.mjs      # → chunks-dld.json  (Dubai bölge tablosu)
node scripts/rag/extract-books.mjs    # → chunks-books.json (İGD e-kitapları)
# aynı partide gidecekleri tek dosyada birleştir

# 2) Backend konteynerinde göm
scp all-chunks.json scripts/rag/embed.mjs deploy@204.168.178.96:/tmp/
ssh deploy@204.168.178.96 'docker cp /tmp/all-chunks.json prei-backend:/tmp/ && \
  docker cp /tmp/embed.mjs prei-backend:/tmp/ && docker exec prei-backend node /tmp/embed.mjs'

# 3) DB host'ta yaz (docs.sql'i taşıyıp)
ssh deploy@157.180.120.75 'docker cp /tmp/docs.sql supabase-db:/tmp/ && \
  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/docs.sql'
```

`docs.sql` tek işlemde çalışır ve **önce aynı `filename`'in eski parçalarını siler** —
yeniden çalıştırmak mükerrer kayıt üretmez.

## Ölçülmüş notlar

- **Sonsuz döngü tuzağı:** parçalama döngüsünde metnin sonuna gelince `i`
  ilerlemiyordu; `end >= length` kontrolü şart.
- **Kalite filtresi (`isProse`) sınırlı:** grafik ekseni artıklarının 31 tanesini
  eledi, ama rapor *databank* tablolarını sağlıklı metinden ayıramıyor
  (harf oranı 0.58–0.74 vs 0.72; benzersiz kelime 0.65–0.68 vs 0.74 — eşik ayırmıyor).
  Bilinçli karar: agresif elemek yerine künye + persona kuralı ile korunuyoruz.
- **`row.values` 1-tabanlı:** ExcelJS'te başta `null` var; `slice(1)` kullan.
- **Kategori ayrımı işe yarıyor:** e-kitaplar `category='education'`, raporlar
  `market_intel`. Ölçüldü — "Dubai JVC kira getirisi" sorgusu ilk üçte yalnız
  `market_intel` döndürüyor, e-kitaplar veri sorgularını boğmuyor.
- **Yayın tarihini uydurma:** e-kitaplarda tarih PDF'in kendi `CreationDate`
  alanından okunuyor (`pdfDate`); okunamazsa dosya atlanıyor. Yanlış tarih,
  tazelik uyarısını sessizce bozar.
