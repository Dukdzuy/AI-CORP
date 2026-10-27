# AI Corp web image (Phase 7, Task 32). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t ai-corp-web .
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY pnpm-workspace.yaml package.json turbo.json tsconfig.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile --filter @ai-corp/web...

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
# Same-origin URLs: nginx below proxies /api, /socket.io and /plantuml
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/
ARG VITE_PLANTUML_SERVER=/plantuml
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_PLANTUML_SERVER=$VITE_PLANTUML_SERVER
RUN rm -f packages/shared-types/tsconfig.tsbuildinfo \
  && pnpm --filter @ai-corp/shared-types build \
  && pnpm --filter @ai-corp/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ >/dev/null || exit 1
