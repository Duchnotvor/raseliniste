#!/bin/sh
set -e

# Phase 1 (root): chown mounted volumes, drop privileges.
if [ "$(id -u)" = "0" ]; then
  for DIR in "$UPLOADS_PATH" "$CACHE_PATH" /data; do
    [ -n "$DIR" ] || continue
    mkdir -p "$DIR" 2>/dev/null || true
    chown -R 1001:1001 "$DIR" 2>/dev/null || true
    chmod -R u+rwX,g+rwX "$DIR" 2>/dev/null || true
  done
  exec su-exec app:nodejs "$0" "$@"
fi

# Phase 2 (app user): heal, migrate, start.
echo "[entrypoint] Healing stale failed migrations (if any)..."
node ./scripts/heal-migrations.mjs || echo "[entrypoint] heal-migrations skipped"

echo "[entrypoint] Running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting Astro Node server on ${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node ./dist/server/entry.mjs
