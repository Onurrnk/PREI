#!/bin/bash
# =====================================================================
# PREI | Yedek geri yükleme provası (E4, Faz 1 kabul edilen genişletme).
# Her gün 03:00'te alınan yedeği aynı Postgres sunucusunda ayrı, geçici
# bir veritabanına geri yükler ve temel bütünlük kontrolü yapar — yalnız
# dosyanın var olduğunu değil, GERÇEKTEN geri yüklenebilir olduğunu
# kanıtlar. Prod veritabanına hiç dokunmaz.
# =====================================================================
set -e

DRILL_DB="prei_restore_drill"
LATEST=$(ls -t /opt/prei/backups/backup_*.dump 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "[restore-drill] $(date): HATA — hiç yedek dosyası bulunamadı"
  exit 1
fi

echo "[restore-drill] $(date): test ediliyor -> $LATEST"

docker exec supabase-db psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DRILL_DB;" > /dev/null
docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE $DRILL_DB;" > /dev/null
# Extension'lar per-database'dir, dump'ta yok (schema=public) — restore
# öncesi elle kurulmalı (2026-07-06 VPS taşımasında da aynı adım gerekmişti).
docker exec supabase-db psql -U postgres -d "$DRILL_DB" -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS pgcrypto;" > /dev/null
docker cp "$LATEST" supabase-db:/tmp/drill.dump
docker exec supabase-db pg_restore -U postgres -d "$DRILL_DB" --no-owner --no-privileges /tmp/drill.dump || true
docker exec supabase-db rm /tmp/drill.dump

TABLES=$(docker exec supabase-db psql -U postgres -d "$DRILL_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
LEADS=$(docker exec supabase-db psql -U postgres -d "$DRILL_DB" -tAc "SELECT count(*) FROM leads" 2>/dev/null || echo 0)
DOCS=$(docker exec supabase-db psql -U postgres -d "$DRILL_DB" -tAc "SELECT count(*) FROM documents" 2>/dev/null || echo 0)
RLS_FNS=$(docker exec supabase-db psql -U postgres -d "$DRILL_DB" -tAc "SELECT count(*) FROM pg_proc WHERE proname IN ('app_tenant','app_user','app_role','app_is_privileged')")

echo "[restore-drill] tablolar=$TABLES leads=$LEADS documents(RAG)=$DOCS rls_fonksiyonlari=$RLS_FNS"

docker exec supabase-db psql -U postgres -d postgres -c "DROP DATABASE $DRILL_DB;" > /dev/null

if [ "$TABLES" -lt 30 ] || [ "$DOCS" -lt 1000 ] || [ "$RLS_FNS" -lt 4 ]; then
  echo "[restore-drill] $(date): BAŞARISIZ — sayılar beklenenden düşük, yedek şüpheli"
  exit 1
fi

echo "[restore-drill] $(date): BAŞARILI — yedek geri yüklenebilir durumda"
