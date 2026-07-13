#!/bin/bash
# =====================================================================
# PREI | Backend deploy — prei-vps-02
# Kaynağı paketler, sunucuya taşır, imajı orada derler, container'ı
# yeniden başlatır. server/.env dokunulmaz (sunucudaki backend.env kalır).
# Kullanım: ./deploy/deploy-backend.sh  (repo kökünden çalıştır)
# =====================================================================
set -euo pipefail

HOST="deploy@204.168.178.96"
KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/opt/prei/backend"
TARBALL="/tmp/prei-server-deploy.tar.gz"

echo "==> Backend paketleniyor..."
cd "$(dirname "$0")/../server"
tar --exclude=node_modules --exclude=dist --exclude=.env -czf "$TARBALL" .

echo "==> vps-02'ye gönderiliyor..."
ssh -i "$KEY" "$HOST" "mkdir -p $REMOTE_DIR"
scp -i "$KEY" "$TARBALL" "$HOST:$REMOTE_DIR/deploy.tar.gz"

echo "==> Sunucuda açılıyor + imaj derleniyor..."
ssh -i "$KEY" "$HOST" "
  cd $REMOTE_DIR &&
  find . -mindepth 1 -maxdepth 1 ! -name deploy.tar.gz -exec rm -rf {} + &&
  tar -xzf deploy.tar.gz && rm deploy.tar.gz &&
  docker build -t prei-backend:latest .
"

echo "==> Container yeniden başlatılıyor..."
ssh -i "$KEY" "$HOST" "cd /opt/prei && docker compose up -d backend"

echo "==> Sağlık kontrolü..."
sleep 4
curl -sf https://api.produality.com/api/health && echo "" && echo "OK — backend canlı." || {
  echo "UYARI: health check başarısız, logları kontrol et:"
  echo "  ssh -i $KEY $HOST 'docker logs prei-backend --tail 50'"
  exit 1
}

rm -f "$TARBALL"
