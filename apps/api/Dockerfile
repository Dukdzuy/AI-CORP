FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo files
COPY pnpm-workspace.yaml .
COPY package.json .
COPY turbo.json .
COPY tsconfig.json .

# Copy packages
COPY packages ./packages

# Copy apps/api
COPY apps/api/package.json apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/nest-cli.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src apps/api/src

# Install dependencies
RUN pnpm install

# Build
RUN pnpm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "dist/main.js"]
