#!/bin/sh
# Auto-deploy del servidor (corre vía systemd timer, ver deploy/README):
# si hay commits nuevos en origin/main, rebuildea y relanza el stack.
set -e

REPO_DIR="${REPO_DIR:-/root/recipi}"
cd "$REPO_DIR"

# Evitar deploys solapados
exec 9>/run/recipi-deploy.lock
flock -n 9 || exit 0

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date -Is) deploy: ${LOCAL#??????????????????????????????} -> ${REMOTE#??????????????????????????????}"
git reset --hard origin/main
docker compose up -d --build
# El sidecar comparte el netns de la app: si la app se recreó, re-atacharlo
docker compose up -d --force-recreate tailscale
docker image prune -f >/dev/null
echo "$(date -Is) deploy OK ($(git rev-parse --short HEAD))"
