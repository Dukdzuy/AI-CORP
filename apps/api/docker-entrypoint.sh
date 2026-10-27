#!/bin/sh
# Applies pending migrations, seeds once on request, then starts the API (Phase 7, Task 32)
set -e

npx prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  node dist-seed/prisma/seed.js
fi

exec node dist/main.js
