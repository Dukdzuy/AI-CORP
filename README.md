# AI Corp Platform

Nền tảng mô phỏng công ty công nghệ ảo với hệ thống AI Agents, tự động hóa toàn bộ quy trình phát triển phần mềm: yêu cầu → lập kế hoạch → phân công task → triển khai code → đánh giá QA → phát hành → tiếp thị.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │Kanban    │ │Virtual   │ │Cost      │          │
│  │          │ │Board     │ │Office    │ │Analytics │          │
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
| Backend | NestJS 10, Prisma ORM, TypeScript |
| Database | PostgreSQL 18 + pgvector |
| Queue | Redis 7 + BullMQ |
| Realtime | Socket.IO (WebSocket) |
| LLM | OpenCode free models via 9Router gateway |
| Sandbox | Docker containers (node:18-alpine) |
| Monorepo | pnpm workspaces + Turborepo |

## Quick Start

```bash
# Prerequisites: Node.js 18+, pnpm 8+, Docker, PostgreSQL

# Install
pnpm install

# Setup environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your configuration

# Initialize database
cd apps/api
pnpm db:push
pnpm db:seed    # Creates admin@aicorp.com / admin123

# Start Redis (required for BullMQ)
docker run -d --name ai-corp-redis -p 6379:6379 redis:7-alpine

# Start dev servers
pnpm dev                    # Terminal 1: Backend :3000
cd ../web && pnpm dev       # Terminal 2: Frontend :5173
```

Open: **http://localhost:5173**

## Key Features

### Multi-Agent Orchestration
Five specialized AI agents collaborate through a DAG-based workflow engine:
- **CEO** - Strategic planning, milestone creation
- **PM** - Task breakdown, prioritization
- **DEV** - Code implementation, testing
- **QA** - Code review, bug detection
- **MARKETING** - Announcement drafting

### Workflow Engine
- DAG-based execution with cycle detection
- Node types: `agent_task`, `human_approval`, `condition`, `parallel`
- Retry with exponential backoff (configurable per node)
- Real-time state transitions via WebSocket
- BullMQ job queue for scalable execution

### LLM Gateway (9Router)
- Free models via 9Router gateway (OpenAI-compatible API)
- Circuit breaker pattern (opens at 3 failures, auto-resets)
- Graceful degradation when LLM unavailable
- Cost tracking with per-project budgets
- Budget alerts at 90% and auto-pause at 100%

### Security
- Docker sandbox isolation (seccomp, non-root user)
- Input sanitization (15+ prompt injection patterns)
- JWT authentication with token expiry
- Role-based access control (admin, board_member)
- Environment variable validation at startup

### Real-time Updates
- WebSocket events for all state changes
- Live agent activity monitoring in Virtual Office
- Real-time Kanban board updates
- Approval notifications with approve/reject buttons

### Cost Analytics
- Token usage tracking per agent and model
- Cost breakdown by agent, model, and date
- Historical cost charts and trends
- Budget management with alerts

## API Documentation

See [API.md](API.md) for complete REST and WebSocket API reference.

## Project Structure

```
ai-corp/
├── apps/
│   ├── api/                              # NestJS backend
│   │   └── src/
│   │       ├── main.ts                   # Application entry
│   │       ├── app.module.ts             # Root module
│   │       └── modules/
│   │           ├── agents/               # AI Agents (CEO, PM, DEV, QA, Marketing)
│   │           ├── approvals/            # Human-in-the-loop approval system
│   │           ├── auth/                 # JWT authentication & guards
│   │           ├── cost/                 # Cost analytics API
│   │           ├── health/               # Health check endpoints
│   │           ├── llm/                  # 9Router LLM gateway integration
│   │           ├── memory/               # Vector search & embeddings
│   │           ├── orchestrator/         # Agent orchestration
│   │           ├── projects/             # CRUD, tasks, milestones
│   │           ├── security/             # Input sanitization
│   │           ├── tools/                # Sandbox executor & tool registry
│   │           ├── websocket/            # Socket.IO gateway
│   │           └── workflow/             # DAG engine & BullMQ worker
│   │
│   └── web/                              # React frontend
│       └── src/
│           ├── components/
│           │   ├── approvals/            # ApprovalModal, Notification
│           │   ├── auth/                 # Login, Register forms
│           │   ├── cost/                 # CostDashboard, Charts
│           │   ├── kanban/               # KanbanBoard, TaskCard
│           │   ├── layout/               # Header, Sidebar, Layout
│           │   └── virtual-office/       # AgentStatusCard, MeetingRoom
│           ├── lib/
│           │   ├── api/                  # HTTP client & React Query hooks
│           │   └── websocket/            # Socket.IO client
│           ├── pages/
│           │   ├── AdminDashboard.tsx     # Admin panel
│           │   ├── AgentDetail.tsx        # Agent detail view
│           │   ├── AgentSettings.tsx      # Model configuration UI
│           │   ├── AuthPage.tsx           # Login / Register
│           │   ├── Dashboard.tsx          # Main dashboard
│           │   ├── ProjectDetail.tsx      # Project detail with tabs
│           │   └── VirtualOffice.tsx      # Virtual office view
│           └── stores/
│               ├── authStore.ts           # Authentication state
│               ├── meetingStore.ts        # Meeting room messages
│               ├── projectStore.ts        # Project state
│               ├── taskStore.ts           # Task state
│               └── websocketStore.ts      # WebSocket connection
│
├── packages/
│   └── shared-types/                     # TypeScript interfaces
│
├── scripts/
│   ├── init-postgres.sql                 # Database init script
│   ├── nine-router-mock.json             # Mock LLM responses
│   └── setup.sh                          # Setup script
│
├── package.json                          # Root package (Turborepo)
├── pnpm-workspace.yaml                   # pnpm workspace config
└── turbo.json                            # Turborepo config
```

## Default Workflow

```
start (CEO) → breakdown (PM) → develop (DEV) → review (QA)
    ↓ (loop on fail)
qa_condition → market (Marketing) → approval (Human) → end (CEO)
```

## Development

```bash
# Tests
cd apps/api
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

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React dev server |
| Backend | 3000 | NestJS API server |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | BullMQ job queue |
| 9Router | 20128 | LLM gateway |

## License

Proprietary - AI Corp Platform
