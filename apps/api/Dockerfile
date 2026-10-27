# AI Corp API image (Phase 7, Task 32). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t ai-corp-api .
FROM node:20-bookworm-slim AS build
# python3/make/g++: native modules (ssh2 via dockerode); openssl: Prisma engines
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY pnpm-workspace.yaml package.json turbo.json tsconfig.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --no-frozen-lockfile --filter @ai-corp/api...

COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN rm -f packages/shared-types/tsconfig.tsbuildinfo \
  && pnpm --filter @ai-corp/shared-types build \
  && cd apps/api \
  && npx prisma generate \
  && pnpm build \
  && pnpm build:seed

FROM node:20-bookworm-slim
# fonts-dejavu-core: Vietnamese glyphs in PDF exports; tini: signal handling for graceful shutdown
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl fonts-dejavu-core tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    PROJECTS_WORKSPACE_DIR=/data/workspace \
    PDF_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
WORKDIR /app
# Dev dependencies stay: the Prisma CLI runs the migrations, and QC's local test runs
# (SANDBOX_ALLOW_LOCAL_RUN) use jest/ts-jest from the API's node_modules
COPY --from=build /app /app
RUN mkdir -p /data/workspace && chown -R node:node /data /app/apps/api
USER node
WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
