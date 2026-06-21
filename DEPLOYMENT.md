# Deployment Guide

## Local Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL (local install or Docker)
- Git

### Setup

```bash
# Clone and install
git clone <repo-url>
cd ai-corp
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your API keys

# Start PostgreSQL (choose one)
# Option A: Local install
#   Windows: choco install postgresql --params "/Password:postgres"
#   macOS:   brew install postgresql@16 && brew services start postgresql@16
#   Linux:   sudo apt install postgresql && sudo systemctl start postgresql

# Option B: Docker
#   docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=neondb postgres:16

# Initialize database
cd apps/api
pnpm db:push
pnpm db:seed    # Creates admin@aicorp.com / admin123

# Start dev servers (in separate terminals)
pnpm dev                    # Backend on :3000
cd ../web && pnpm dev       # Frontend on :5173
```

### Environment Variables

**Required:**
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/neondb` |
| `NINE_ROUTER_API_KEY` | 9Router API key for LLM gateway | `sk-...` |

**Optional:**
| Variable | Description | Default |
|----------|-------------|---------|
| `NINE_ROUTER_URL` | 9Router endpoint | `http://localhost:20128/v1` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Backend port | `3000` |
| `JWT_SECRET` | JWT signing secret | auto-generated |

## Production Deployment

### Docker Compose (Recommended)

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/neondb
      - REDIS_URL=redis://redis:6379
      - NINE_ROUTER_API_KEY=${NINE_ROUTER_API_KEY}
      - NINE_ROUTER_URL=${NINE_ROUTER_URL}
    depends_on:
      - db
      - redis

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api

  db:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=neondb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Running Production

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### Manual Deployment

```bash
# Build backend
cd apps/api
pnpm build

# Build frontend
cd ../web
pnpm build

# Start backend
cd ../api
NODE_ENV=production pnpm start:prod

# Serve frontend with nginx or similar
```

## 9Router Setup

9Router provides intelligent LLM routing with automatic fallback.

### Local Development

```bash
# Start 9Router via docker-compose (included in docker-compose.yml)
docker-compose up -d ninerouter

# Verify it's running
curl http://localhost:20128/health
```

### Configuration

The platform routes requests through 9Router by default:
- Primary: 9Router (localhost:20128) - intelligent routing, cost optimization
- Fallback: Direct Anthropic API - when circuit breaker opens

Circuit breaker thresholds:
- Opens after 3 consecutive failures
- Closes on successful request
- Health check interval: 30 seconds

## Database

### Local PostgreSQL Setup

```bash
# Windows (Chocolatey)
choco install postgresql --params "/Password:postgres"
net start postgresql-x64-16

# Create database
createdb -U postgres neondb

# Or reset everything
cd apps/api
pnpm db:push --force-reset
pnpm db:push
pnpm db:seed
```

### Migrations

```bash
# Create new migration
cd apps/api
pnpm db:migrate --name add_feature

# Apply pending migrations
pnpm db:push

# Reset database (WARNING: deletes all data)
pnpm db:push --force-reset
```

### Backup

```bash
# Backup
pg_dump -U postgres neondb > backup.sql

# Restore
cat backup.sql | psql -U postgres neondb

# Or with Docker
docker exec pg pg_dump -U postgres neondb > backup.sql
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "online", "latencyMs": 5 },
    "ninerouter": { "status": "online", "latencyMs": 120 }
  }
}
```

### Logs

Structured JSON logs are emitted for all major operations:
- `llm_request` - LLM gateway calls with token usage
- `workflow_step` - Workflow node execution
- `tool_execution` - Sandbox tool runs
- `memory_save` / `memory_search` - Memory operations

### WebSocket Monitoring

Connect to the WebSocket to monitor real-time activity:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'jwt-token' }
});

socket.on('workflow:state_changed', (data) => {
  console.log('Workflow:', data);
});

socket.on('agent:thinking', (data) => {
  console.log('Agent activity:', data);
});
```

## Troubleshooting

### Common Issues

**Database connection refused:**
```bash
# Check PostgreSQL is running
# Windows
net start postgresql-x64-16

# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql

# Test connection
psql -U postgres -d neondb -c "SELECT 1;"
```

**9Router unavailable:**
```bash
# Check 9Router status
curl http://localhost:20128/health

# The system will automatically fallback to other models
```

**WebSocket connection failed:**
- Ensure JWT token is valid
- Check CORS configuration
- Verify WebSocket URL (ws://localhost:3000)

### Performance Tuning

**Database:**
- Indexes on Task(projectId, status) and ApiUsageLog(projectId, createdAt)
- Connection pooling configured via Prisma

**Redis:**
- Used for BullMQ job queues and caching (optional)
- Workflow context cached with 30s TTL
- Server runs in degraded mode without Redis

**Docker:**
- Sandbox containers limited to 512MB memory, 50% CPU
- Containers auto-cleanup after execution
- Read-only root filesystem with writable /tmp
