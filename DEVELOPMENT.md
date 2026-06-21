# Development Guide

This guide covers the development workflow for the AI Corp Platform.

## Project Structure

```
ai-corp/
├── apps/
│   ├── api/                  # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts       # Application entry point
│   │   │   ├── app.module.ts # Root module
│   │   │   └── prisma/       # Database service
│   │   ├── prisma/
│   │   │   └── schema.prisma # Database schema
│   │   └── package.json
│   │
│   └── web/                  # React Frontend
│       ├── src/
│       │   ├── main.tsx      # Application entry point
│       │   ├── App.tsx       # Root component
│       │   └── index.css     # Global styles
│       ├── index.html        # HTML template
│       └── vite.config.ts    # Vite configuration
│
├── packages/
│   └── shared-types/         # Shared TypeScript types
│       ├── src/
│       │   ├── agent.types.ts
│       │   ├── task.types.ts
│       │   ├── workflow.types.ts
│       │   ├── websocket.types.ts
│       │   └── index.ts
│       └── package.json
│
├── docker-compose.yml        # Local development services
├── package.json              # Root workspace package
├── pnpm-workspace.yaml       # pnpm workspaces config
├── turbo.json                # Turbo build config
├── tsconfig.json             # Root TypeScript config
├── jest.config.js            # Jest test config
└── README.md
```

## Initial Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Docker Services

```bash
docker-compose up -d
```

Services will be available at:
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- 9Router Mock: localhost:20128

### 3. Setup Database

```bash
cd apps/api
pnpm db:push
```

This will:
- Create all database tables from Prisma schema
- Create pgvector indexes
- Enable the pgvector extension

### 4. Configure Environment Variables

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Edit apps/api/.env and add:
# - NINE_ROUTER_API_KEY (optional for local dev)
# - ANTHROPIC_API_KEY (optional for local dev)
# - OPENAI_API_KEY (optional for local dev)

# Frontend
cp apps/web/.env.example apps/web/.env
```

## Development Workflow

### Starting Development Servers

**Terminal 1 - Backend:**
```bash
cd apps/api
pnpm dev
```

The backend will start on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd apps/web
pnpm dev
```

The frontend will start on http://localhost:5173

### Building

Build all packages:
```bash
pnpm build
```

Build specific packages:
```bash
pnpm --filter @ai-corp/api build
pnpm --filter @ai-corp/web build
```

### Testing

Run all tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

Run tests for specific package:
```bash
pnpm --filter @ai-corp/api test
pnpm --filter @ai-corp/web test
```

### Linting and Formatting

Lint all code:
```bash
pnpm lint
```

Format all code:
```bash
pnpm format
```

## Database Management

### Prisma Commands

View database schema:
```bash
cd apps/api
pnpm prisma studio
```

This opens an interactive UI at http://localhost:5555 to browse and edit data.

Create a new migration:
```bash
cd apps/api
pnpm prisma migrate dev --name add_new_table
```

Reset database (WARNING: Deletes all data):
```bash
cd apps/api
pnpm prisma migrate reset
```

## Adding Dependencies

### Add to specific workspace

```bash
# Add to backend
pnpm --filter @ai-corp/api add package-name

# Add to frontend
pnpm --filter @ai-corp/web add package-name

# Add to shared types
pnpm --filter @ai-corp/shared-types add package-name

# Add dev dependency
pnpm --filter @ai-corp/api add -D package-name
```

### Add to root workspace

```bash
pnpm add -w package-name
```

## Creating New Modules

### Backend Module (NestJS)

1. Create module directory:
```bash
mkdir apps/api/src/modules/my-module
```

2. Create module files:
```bash
touch apps/api/src/modules/my-module/{my-module.module.ts,my-module.service.ts,my-module.controller.ts}
```

3. Register in app.module.ts

### Frontend Component

1. Create component directory:
```bash
mkdir apps/web/src/components/MyComponent
```

2. Create component files:
```bash
touch apps/web/src/components/MyComponent/{MyComponent.tsx,MyComponent.test.tsx}
```

## Adding Shared Types

Types shared between backend and frontend should go in `packages/shared-types/src/`.

1. Create the type file:
```bash
touch packages/shared-types/src/my-types.ts
```

2. Export from `packages/shared-types/src/index.ts`

3. Import in backend/frontend:
```typescript
import { MyType } from '@ai-corp/shared-types';
```

## Database Schema Changes

### Making Schema Changes

1. Edit `apps/api/prisma/schema.prisma`

2. Create migration:
```bash
cd apps/api
pnpm prisma migrate dev --name describe_change
```

3. Prisma client is auto-generated from schema

## Common Issues and Solutions

### Port Already in Use

If port 5173 or 3000 is already in use:

```bash
# Find process using port
netstat -tlnp | grep :3000

# Kill process (adjust PID)
kill -9 <PID>
```

### Database Connection Issues

Check database is running:
```bash
docker-compose ps
docker-compose logs postgres
```

Restart database:
```bash
docker-compose restart postgres
```

### Stale Dependencies

Clear all node_modules and reinstall:
```bash
pnpm clean
pnpm install
```

### Module Resolution Issues

Ensure paths in `tsconfig.json` are correct:
```json
{
  "paths": {
    "@ai-corp/shared-types": ["packages/shared-types/src"],
    "@ai-corp/shared-types/*": ["packages/shared-types/src/*"]
  }
}
```

## Code Style

### Prettier Format

```bash
# Format entire workspace
pnpm format

# Format specific file
prettier --write apps/api/src/main.ts
```

### ESLint

```bash
# Lint entire workspace
pnpm lint

# Lint specific package
pnpm --filter @ai-corp/api lint

# Fix linting issues
pnpm lint -- --fix
```

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes following code style guidelines
3. Run tests: `pnpm test`
4. Commit changes: `git commit -am 'Add my feature'`
5. Push to branch: `git push origin feature/my-feature`
6. Submit pull request

## Useful Commands Summary

```bash
# Setup
pnpm install
docker-compose up -d
cd apps/api && pnpm db:push

# Development
cd apps/api && pnpm dev  # Terminal 1
cd apps/web && pnpm dev  # Terminal 2

# Building
pnpm build
pnpm --filter @ai-corp/api build

# Testing
pnpm test
pnpm test:watch

# Code Quality
pnpm lint
pnpm format

# Database
cd apps/api && pnpm prisma studio
cd apps/api && pnpm prisma migrate dev --name migration_name

# Stop services
docker-compose down
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turbo Documentation](https://turbo.build)
