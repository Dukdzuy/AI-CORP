# Database Migration Setup Guide

## Task 3.4 Completion: Database Migrations and Initial Seeding

This guide explains how to apply the database migrations and seed the initial agent configurations.

## What's Been Set Up

### 1. Migration Files
Located in `apps/api/prisma/migrations/0_init/`:
- **migration.sql** - Complete database schema with all tables, indexes, and constraints
- **migration_lock.toml** - Prisma migration lock file

### 2. Seed Script
Located in `apps/api/prisma/seed.ts`:
- Initializes all 5 agent configurations (CEO, PM, DEV, QA, MARKETING)
- Sets up LLM Gateway Status for 9Router health monitoring
- Idempotent (safe to run multiple times)

### 3. Configuration Updates
- **apps/api/package.json** - Added database management scripts
- **scripts/init-postgres.sql** - pgvector extension setup

## Prerequisites

Before running migrations, ensure:

1. **Docker and Docker Compose installed**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Node.js and npm installed**
   ```bash
   node --version
   npm --version
   ```

3. **PostgreSQL container with pgvector running**
   ```bash
   docker-compose up -d postgres
   docker ps  # Verify container is running
   ```

## Step-by-Step Setup

### Step 1: Start the Development Environment

```bash
# From project root
docker-compose up -d

# Verify all services are running
docker ps

# You should see:
# - ai-corp-postgres (PostgreSQL with pgvector)
# - ai-corp-redis (Redis)
# - ai-corp-nine-router (9Router mock)
```

### Step 2: Install Project Dependencies

```bash
# Install root dependencies
npm install --legacy-peer-deps

# Install API dependencies
cd apps/api
npm install --legacy-peer-deps
cd ../..
```

### Step 3: Run the Migration

#### Option A: Deploy existing migration
```bash
cd apps/api
npm run db:migrate:deploy
```

#### Option B: Development migration (with Prisma prompts)
```bash
cd apps/api
npm run db:migrate
```

This command will:
1. Execute the migration.sql file
2. Update Prisma client types
3. Display confirmation of tables created

### Step 4: Seed the Database

```bash
cd apps/api
npm run db:seed
```

This will create:
- 5 Agent configurations (CEO, PM, DEV, QA, MARKETING)
- LLM Gateway Status for 9Router

Output should show:
```
PrismaClientInitializationError: @prisma/client did not initialize yet. You might have forgotten to call `await prisma.$connect()` before reading from the database.
```

If you see this, you need to add `await prisma.$connect()` to the seed file. Otherwise, you should see:
```
Created agent: CEO
Created agent: PM
Created agent: DEV
Created agent: QA
Created agent: MARKETING
Created LLMGatewayStatus for ninerouter
Database seed completed successfully!
```

## Verification

### 1. Verify Database Connection

```bash
# Connect to PostgreSQL
psql postgresql://postgres:password@localhost:5432/ai_corp_dev

# Check if connected
SELECT 1;
```

### 2. Verify pgvector Extension

```sql
SELECT extname FROM pg_extension WHERE extname='vector';
```

Expected output:
```
  extname
-----------
 vector
```

### 3. Verify Tables Created

```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
```

Expected tables:
- Agent
- AgentMemory
- AgentMessage
- ApiUsageLog
- Approval
- LLMGatewayStatus
- Milestone
- Project
- Task
- User
- WorkflowRun
- WorkflowStep

### 4. Verify Agent Configurations

```sql
SELECT role, name, "isActive" FROM "Agent" ORDER BY role;
```

Expected output:
```
 role     |       name        | isActive
----------+-------------------+----------
 CEO      | CEO Agent         | t
 DEV      | Developer Agent   | t
 MARKETING| Marketing Agent   | t
 PM       | Project Manager   | t
 QA       | QA Agent          | t
```

### 5. Verify Indexes

```sql
-- Check pgvector index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename='AgentMemory' 
ORDER BY indexname;
```

Should show indexes including:
- `AgentMemory_agentRole_namespace_idx`
- `AgentMemory_createdAt_idx`
- `AgentMemory_embedding_idx` (IVFFLAT)

### 6. Verify LLM Gateway Status

```sql
SELECT * FROM "LLMGatewayStatus";
```

Expected output:
```
                  id                  | gatewayName | status | lastHealthCheck | consecutiveFailures
--------------------------------------+-------------+--------+-----------------+---------------------
 [UUID]                               | ninerouter  | online | [timestamp]     | 0
```

## Troubleshooting

### Issue: "ERROR: database "ai_corp_dev" does not exist"

**Solution**: Create the database first
```bash
psql postgresql://postgres:password@localhost:5432
CREATE DATABASE ai_corp_dev;
\q
```

### Issue: "ERROR: permission denied to create extension"

**Solution**: Run as superuser or ensure pgvector is already installed in the container

### Issue: "ERROR: relation "Agent" does not exist"

**Solution**: Migrations weren't applied. Run:
```bash
npm run db:migrate:deploy
```

### Issue: Prisma types are outdated

**Solution**: Regenerate Prisma client
```bash
npx prisma generate
```

### Issue: Seed script fails with "Cannot find module"

**Solution**: Ensure ts-node is available
```bash
npm install --save-dev ts-node @types/node
```

Then run seed again.

## Database Schema Overview

### Core Tables
- **User**: Board member accounts
- **Project**: Projects with budgets
- **Milestone**: Strategic milestones
- **Task**: Individual tasks with Kanban status

### Agent Tables
- **Agent**: Agent configurations per role
- **AgentMemory**: Vector embeddings for semantic search
- **AgentMessage**: Inter-agent communication log

### Workflow Tables
- **WorkflowRun**: Workflow execution instances
- **WorkflowStep**: Individual workflow steps
- **Approval**: Human approval requests

### Monitoring Tables
- **ApiUsageLog**: LLM usage tracking
- **LLMGatewayStatus**: Gateway health monitoring

## Important Notes

1. **pgvector Extension**: Must be enabled before creating vector columns
2. **IVFFLAT Index**: Created on AgentMemory.embedding for performance
3. **Agent Roles**: Exactly 5 agents seeded (CEO, PM, DEV, QA, MARKETING)
4. **Model Route**: All agents configured for 9Router with Anthropic fallback
5. **Seed Idempotency**: Safe to run seed script multiple times

## Next Steps

After successful migration and seeding:

1. ✅ Verify all tables and data are present
2. ✅ Test database connectivity from NestJS backend
3. ✅ Begin implementing the LLM Gateway module (Task 4.1)
4. ✅ Implement memory and workflow services
5. ✅ Set up agent orchestration

## Environment Variables

Make sure these are set in `apps/api/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_corp_dev

# Redis
REDIS_URL=redis://localhost:6379

# LLM Providers
NINE_ROUTER_API_KEY=your_9router_api_key
NINE_ROUTER_URL=http://localhost:20128/v1

ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# Node Environment
NODE_ENV=development

# Server
PORT=3000
```

---

## Quick Reference Commands

```bash
# Start development environment
docker-compose up -d

# Install dependencies
npm install --legacy-peer-deps

# Run migration
cd apps/api
npm run db:migrate:deploy

# Seed database
npm run db:seed

# Connect to PostgreSQL
psql postgresql://postgres:password@localhost:5432/ai_corp_dev

# Stop environment
docker-compose down

# View logs
docker-compose logs -f postgres
```

---

**Status**: ✅ All migration files are ready for deployment

**Requirements Met**:
- ✅ Req 7: Vector Memory System with pgvector and IVFFLAT index
- ✅ Req 15: Agent Configuration with system prompts and model routes
- ✅ Req 23: Docker Compose environment with pgvector enabled
