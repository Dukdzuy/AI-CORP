# AI Corp Platform

A web-based platform that simulates a virtual tech company where all employees are AI Agents powered by Large Language Models (LLMs). The platform automates the complete software development lifecycle: requirements → planning → task breakdown → code implementation → QA review → release → marketing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │Kanban    │ │Virtual   │ │Admin     │          │
│  │          │ │Board     │ │Office    │ │Dashboard │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket + REST
┌────────────────────────────┴────────────────────────────────────┐
│                        Backend (NestJS)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Workflow  │ │Agent     │ │LLM       │ │Memory    │          │
│  │Engine    │ │Orchestr. │ │Gateway   │ │Service   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Tool      │ │Auth      │ │Projects  │ │WebSocket │          │
│  │Execution │ │Module    │ │Module    │ │Gateway   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     Infrastructure                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │PostgreSQL│ │Redis     │ │Docker    │ │9Router   │          │
│  │+ pgvector│ │+ BullMQ  │ │Sandbox   │ │LLM Gate  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Ant Design, Zustand, React Query |
| Backend | NestJS, Prisma ORM, TypeScript |
| Database | PostgreSQL (local or Neon cloud) |
| Queue | Redis 7 + BullMQ (optional, degraded mode when unavailable) |
| Realtime | Socket.IO (WebSocket) |
| LLM | OpenCode free models via 9Router gateway |
| Sandbox | Docker containers (seccomp, AppArmor, non-root) |
| Monorepo | pnpm workspaces + Turbo |

## Quick Start

```bash
# Prerequisites: Node.js 18+, pnpm 8+

# Install
pnpm install

# Setup environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your NINE_ROUTER_API_KEY

# Install & start PostgreSQL (Windows)
choco install postgresql --params "/Password:postgres"
# Or use Docker: docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16

# Initialize database
cd apps/api
pnpm db:push
pnpm db:seed    # Creates admin@aicorp.com / admin123

# Start dev servers
pnpm dev                    # Terminal 1: Backend :3000
cd ../web && pnpm dev       # Terminal 2: Frontend :5173
```

Open: **http://localhost:5173/auth**

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions.

## Key Features

### Multi-Agent Orchestration
Five specialized AI agents work together through a DAG-based workflow engine:
- **CEO** - Strategic planning, milestone creation
- **PM** - Task breakdown, prioritization
- **DEV** - Code implementation, testing
- **QA** - Code review, bug detection
- **MARKETING** - Announcement drafting

### Workflow Engine
- DAG-based execution with cycle detection
- Node types: agent_task, human_approval, condition, parallel
- Retry with exponential backoff (configurable per node)
- Real-time state transitions via WebSocket

### LLM Gateway (OpenCode Free Models)
- Free models via 9Router gateway (OpenAI-compatible)
- Models: `oc/deepseek-v4-flash-free`, `oc/big-pickle`, `oc/mimo-v2.5-free`, `oc/north-mini-code-free`, `oc/nemotron-3-ultra-free`
- Circuit breaker pattern (opens at 3 failures)
- Graceful degradation when LLM unavailable
- Cost tracking with per-project budgets

### Security
- Docker sandbox isolation (seccomp, AppArmor, non-root)
- Input sanitization (15 prompt injection patterns)
- JWT authentication with refresh tokens
- Role-based access control
- Environment variable validation at startup

### Real-time Updates
- WebSocket events for all state changes
- Live agent activity monitoring
- Real-time Kanban board updates
- Health status alerts

## API Documentation

See [API.md](API.md) for complete REST and WebSocket API reference.

## Project Structure

```
ai-corp/
├── apps/
│   ├── web/                          # React frontend
│   │   └── src/
│   │       ├── components/           # UI components
│   │       │   ├── kanban/          # KanbanBoard, TaskCard
│   │       │   ├── virtual-office/  # AgentStatusCard, MeetingRoom
│   │       │   ├── approvals/       # ApprovalModal, Notification
│   │       │   └── cost/            # CostDashboard, Charts
│   │       ├── pages/               # Route pages
│   │       ├── stores/              # Zustand state
│   │       └── lib/api/             # HTTP client, hooks, WS
│   │
│   └── api/                          # NestJS backend
│       └── src/
│           └── modules/
│               ├── agents/          # CEO, PM, Dev, QA, Marketing
│               ├── orchestrator/    # Agent orchestration
│               ├── workflow/        # DAG engine, validator
│               ├── llm/             # 9Router, Anthropic providers
│               ├── memory/          # Vector search, embeddings
│               ├── tools/           # Sandbox executor, registry
│               ├── projects/        # CRUD, tasks, milestones
│               ├── auth/            # JWT, guards
│               ├── websocket/       # Socket.IO gateway
│               ├── security/        # Input sanitization
│               └── health/          # Health checks
│
└── packages/
    └── shared-types/                # TypeScript interfaces
```

## Default Workflow

```
start → CEO (planMilestones) → PM (breakdownTasks) → Dev (implement)
    ↓ (loop)
QA (review) → condition (approved?)
    ├── No → Dev (re-implement)
    └── Yes → Marketing (announce) → Approval (human) → CEO (complete)
```

## Development

```bash
# Tests
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode

# Build
pnpm build                   # Build all packages

# Lint
pnpm lint                    # Lint all code
pnpm format                  # Format all code

# Database
cd apps/api
pnpm db:push                 # Sync schema
pnpm db:seed                 # Seed admin + agents
pnpm db:migrate --name feat  # Create migration
```

## Default Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@aicorp.com` | `admin123` | admin |

## License

Proprietary - AI Corp Platform
