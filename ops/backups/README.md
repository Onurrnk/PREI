# Yedekleme + geri yükleme provası (prei-vps-01)

Bu dosyalar `/opt/prei/` altında canlıda çalışan script'lerin referans kopyasıdır (repo'ya commit edilmiş kaynak — çalışan kopyayı değiştirmek için VPS'e `scp` ile yeniden yüklenmesi gerekir, otomatik senkron yok).

## backup.sh
Cron: `0 3 * * *` (her gün 03:00 UTC). `supabase-db` container'ında `pg_dump --schema=public --no-owner --no-privileges --format=custom` alır, `/opt/prei/backups/backup_<STAMP>.dump`'a kopyalar, 7 günden eski dosyaları siler. Log: `/opt/prei/backups/backup.log`.

## restore-drill.sh (E4 — Faz 1 kabul edilen genişletme, 2026-07-14 kuruldu)
Cron: `15 3 * * *` (yedekten 15 dakika sonra). **Her gün en son yedeği gerçekten geri yükleyip doğrular** — yalnız dosyanın var olduğunu değil, geri yüklenebilir olduğunu kanıtlar. Aynı Postgres sunucusunda ayrı, geçici bir veritabanına (`prei_restore_drill`) restore eder, tablo/lead/RAG-chunk/RLS-fonksiyon sayılarını beklenen eşiklerle karşılaştırır, sonunda geçici veritabanını siler — **prod'a hiç dokunmaz**. Log: `/opt/prei/backups/restore-drill.log`.

**Bilinen, zararsız hata (script bunu görmezden gelir, `pg_restore --exit-on-error` kullanılmaz):** dump'ta cloud Supabase'den kalma 4 eski RLS politikası var (`company_knowledge`/`documents` üzerinde `auth.role()` referanslı — gerçek `auth` şeması bare bir Postgres'te yok). Bunlar PREI'nin gerçekte kullandığı RLS modelinin (app_tenant/app_user/app_role GUC fonksiyonları, migrations/001+002b) parçası DEĞİL — cloud→VPS taşımasından önceki otomatik-üretilmiş varsayılan politikalar, temizlenmemiş kalıntı. Restore'u bloklamıyor ama temiz değil; ileride `documents`/`company_knowledge` üzerindeki bu 2 eski policy DROP edilebilir (kozmetik, aciliyet yok).

**Extension notu:** `vector`/`pg_trgm`/`uuid-ossp`/`pgcrypto` per-database'dir, `--schema=public` dump'ında YOK — restore öncesi script bunları elle kurar (2026-07-06 cloud→VPS taşımasında da aynı adım gerekmişti, bkz. proje belleği).

## KALAN (bilinçli sınır)
Yedekler yalnız yerelde (`/opt/prei/backups`, prei-vps-01) — off-site/uzak kopya yok. vps-01'in kendisi kaybolursa (disk arızası, yanlışlıkla silme) hem prod hem yedek aynı anda gider. Gerçek bir off-site kopya (ör. Hetzner Storage Box, S3-uyumlu) ayrı bir iş — henüz kurulmadı.
