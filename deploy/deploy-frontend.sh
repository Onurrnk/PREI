#!/bin/bash
# =====================================================================
# PREI | Frontend deploy — prei-vps-02
# Production build alır (.env.production.local'daki gerçek domain
# değerleriyle), statik dosyaları Caddy'nin sunduğu klasöre gönderir.
# Container restart gerekmez — Caddy diskten okur.
# Kullanım: ./deploy/deploy-frontend.sh  (repo kökünden çalıştır)
# =====================================================================
set -euo pipefail

HOST="deploy@204.168.178.96"
KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/opt/prei/frontend"
TARBALL="/tmp/prei-frontend-deploy.tar.gz"

cd "$(dirname "$0")/.."

if [ ! -f .env.production.local ]; then
  echo "HATA: .env.production.local yok — production domain değerleri olmadan build almam."
  exit 1
fi

echo "==> Production build alınıyor..."
npm run build

echo "==> Doğru domain'ler build'e gömülmüş mü kontrol ediliyor..."
if ! grep -q "api.produality.com" dist/assets/index-*.js; then
  echo "HATA: build'de api.produality.com bulunamadı — .env.production.local'ı kontrol et."
  exit 1
fi

echo "==> Paketleniyor..."
tar -czf "$TARBALL" -C dist .

echo "==> vps-02'ye gönderiliyor..."
scp -i "$KEY" "$TARBALL" "$HOST:/opt/prei/"
# DİKKAT: $REMOTE_DIR klasörünü rm -rf ile SİLİP yeniden oluşturma — Caddy
# çalışırken buraya bind-mount'lu, klasör inode'u değişince mount kopar
# (container 404 vermeye başlar, restart gerektirir). Yalnız İÇERİĞİNİ temizle.
ssh -i "$KEY" "$HOST" "
  mkdir -p $REMOTE_DIR &&
  find $REMOTE_DIR -mindepth 1 -delete &&
  tar -xzf /opt/prei/prei-frontend-deploy.tar.gz -C $REMOTE_DIR &&
  rm /opt/prei/prei-frontend-deploy.tar.gz
"

echo "==> Doğrulama..."
sleep 2
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://prei.produality.com/)
if [ "$STATUS" = "200" ]; then
  echo "OK — frontend canlı."
else
  echo "UYARI: prei.produality.com HTTP $STATUS döndü."
  exit 1
fi

rm -f "$TARBALL" /tmp/prei-frontend-dist.tar.gz 2>/dev/null || true
