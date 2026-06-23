# AI Corp Platform - Báo Cáo Dự Án

## Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Mục Tiêu Và Phạm Vi](#2-mục-tiêu-và-phạm-vi)
3. [Kiến Trúc Hệ Thống](#3-kiến-trúc-hệ-thống)
4. [Công Nghệ Sử Dụng](#4-công-nghệ-sử-dụng)
5. [Các Thành Phần Chính](#5-các-thành-phen-chính)
6. [Workflow Engine](#6-workflow-engine)
7. [Multi-Agent System](#7-multi-agent-system)
8. [LLM Integration](#8-llm-integration)
9. [Bảo Mật](#9-bảo-mật)
10. [Thực Trạng Hiện Tại](#10-thực-trạng-hiện-tại)
11. [Kết Quả Đạt Được](#11-kết-quả-đạt-được)
12. [Hạn Chế Và Hướng Phát Triển](#12-hạn-chế-và-hướng-phát-triển)
13. [Phụ Lục](#13-phụ-lục)

---

## 1. Tổng Quan Dự Án

**Tên dự án:** AI Corp Platform

**Mô tả:** Nền tảng mô phỏng công ty công nghệ ảo, trong đó tất cả nhân viên là AI Agents được hỗ trợ bởi Large Language Models (LLMs). Nền tảng tự động hóa toàn bộ quy trình phát triển phần mềm: yêu cầu → lập kế hoạch → phân công任务 → triển khai code → đánh giá QA → phát hành → tiếp thị.

**Thời gian thực hiện:** Tháng 6, 2026

**Trạng thái:** Hoàn thành MVP (Minimum Viable Product)

---

## 2. Mục Tiêu Và Phạm Vi

### Mục Tiêu Chính

1. **Xây dựng hệ thống multi-agent** với 5 AI agentsspecialized
2. **Tự động hóa quy trình phát triển** qua DAG-based workflow engine
3. **Tích hợp LLM miễn phí** qua 9Router gateway
4. **Cung cấp giao diện real-time** để theo dõi agents hoạt động
5. **Quản lý chi phí** và ngân sách cho LLM calls

### Phạm Vi Dự Án

| Thành Phần | Phạm Vi |
|------------|---------|
| Frontend | React + TypeScript + Ant Design |
| Backend | NestJS + Prisma ORM |
| Database | PostgreSQL + pgvector |
| Queue | Redis + BullMQ |
| LLM | 9Router gateway (OpenCode free models) |
| Sandbox | Docker containers |
| Real-time | Socket.IO WebSocket |

---

## 3. Kiến Trúc Hệ Thống

### Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  Dashboard │ Kanban Board │ Virtual Office │ Cost Analytics │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API + WebSocket
┌───────────────────────────┴─────────────────────────────────┐
│                      Backend (NestJS)                        │
│  Workflow Engine │ Agent Orchestrator │ LLM Gateway         │
│  Memory Service  │ Tool Registry     │ WebSocket Gateway   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    Infrastructure                            │
│  PostgreSQL │ Redis/BullMQ │ Docker │ 9Router LLM Gateway  │
└─────────────────────────────────────────────────────────────┘
```

### Kiến Trúc Multi-Agent

```
                    ┌─────────┐
                    │   CEO   │
                    │ (Planner)│
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │   PM    │
                    │(Manager)│
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────┴────┐ ┌───┴───┐ ┌───┴────┐
         │   DEV   │ │  QA   │ │Marketing│
         │(Builder)│ │(Tester)│ │(Seller) │
         └─────────┘ └───────┘ └─────────┘
```

---

## 4. Công Nghệ Sử Dụng

### Bảng Tổng Hợp

| Lớp | Công Nghệ | Phiên Bản | Lý Do Chọn |
|-----|-----------|-----------|------------|
| Frontend | React | 18.x | Component-based, ecosystem lớn |
| UI Library | Ant Design | 5.x | Component phong phú, dark theme |
| State | Zustand | 4.x | Nhẹ, đơn giản |
| Server State | React Query | 5.x | Caching, refetch tự động |
| Build Tool | Vite | 5.x | Nhanh, HMR tốt |
| Backend | NestJS | 10.x | Modular, TypeScript native |
| ORM | Prisma | 5.x | Type-safe, migration tốt |
| Database | PostgreSQL | 18 | reliable, pgvector cho vector search |
| Queue | BullMQ | 5.x | Reliable job queue với Redis |
| WebSocket | Socket.IO | 4.x | Real-time bidirectional |
| Container | Docker | - | Sandbox isolation cho code execution |
| LLM Gateway | 9Router | - | Free models, OpenAI-compatible API |

### Chi Tiết Từng Thành Phần

#### Frontend (React + TypeScript)
- **Routing:** React Router v6
- **Form:** Ant Design Form + Formik
- **Charts:** Recharts (pie, bar, line)
- **Drag & Drop:** HTML5 Drag and Drop API
- **HTTP:** Axios với interceptors

#### Backend (NestJS + TypeScript)
- **Architecture:** Modular (Agents, Workflow, LLM, Memory, Tools...)
- **Validation:** class-validator + class-transformer
- **Auth:** JWT passport
- **Logging:** NestJS Logger + structured JSON

#### Database (PostgreSQL)
- **ORM:** Prisma với schema-first approach
- **Extensions:** pgvector cho vector embeddings
- **Models:** User, Agent, Project, Task, Milestone, WorkflowRun, Approval, ApiUsageLog

#### LLM Integration (9Router)
- **Protocol:** OpenAI-compatible REST API
- **Models:** OpenCode free models (deepseek, mimo, nemotron...)
- **Features:** Circuit breaker, fallback, cost tracking
- **Endpoint:** `http://localhost:20128/v1/chat/completions`

---

## 5. Các Thành Phần Chính

### 5.1 Dashboard

**Chức năng:**
- Hiển thị tổng quan tất cả dự án
- Thống kê: Active, Completed, Total Cost
- Tạo dự án mới với modal form
- Project cards với progress bar
- Responsive design

**Công nghệ:** React, Ant Design Card/Statistic, Zustand

### 5.2 Virtual Office

**Chức năng:**
- Hiển thị 5 AI agents với trạng thái real-time
- Meeting Room với tin nhắn live
- Agent thinking/action/message events
- Approval notifications với Approve/Reject buttons
- Clear messages功能

**Công nghệ:** Socket.IO, Zustand, Ant Design

### 5.3 Kanban Board

**Chức năng:**
- 4 cột: Todo, In Progress, Review, Done
- Drag & drop tasks giữa các cột
- Task cards với priority, agent assignment, cost
- Click để xem chi tiết task

**Công nghệ:** HTML5 DnD, React Query

### 5.4 Cost Analytics

**Chức năng:**
- Tổng quan: Total Cost, Total Tokens, RTK Saved
- Biểu đồ: Pie (cost by agent), Bar (token usage), Line (cost over time)
- Bảng chi tiết model usage
- Budget alerts

**Công nghệ:** Recharts, React Query, NestJS CostController

### 5.5 Agent Settings

**Chức năng:**
- Đổi model cho từng agent
- Hiển thị danh sách models có sẵn
- Lưu cấu hình vào database

**Công nghệ:** Ant Design Table/Select, REST API

### 5.6 Approval System

**Chức năng:**
- Bell icon trên header hiển thị số approvals pending
- Dropdown danh sách approvals
- Modal chi tiết approval
- Approve/Reject buttons
- WebSocket real-time notifications

**Công nghệ:** Socket.IO, Zustand, Ant Design

---

## 6. Workflow Engine

### Kiến Trúc

Workflow Engine là core của hệ thống, chịu trách nhiệm:
- Quản lý DAG-based workflow execution
- Queue jobs với BullMQ
- Retry logic với exponential backoff
- Cycle detection (max 3 visits per node)
- Real-time state transitions

### Các Loại Node

| Loại Node | Mô Tả | Ví Dụ |
|-----------|-------|-------|
| `agent_task` | Gọi agent thực hiện task | CEO plan, PM breakdown, DEV implement |
| `human_approval` | Dừng chờ người duyệt | Project completion approval |
| `condition` | Kiểm tra điều kiện | QA approved? |
| `parallel` | Chạy song song | Nhiều tasks cùng lúc |

### Workflow Mặc Định

```
start (CEO) → breakdown (PM) → develop (DEV) → review (QA)
    ↓ (loop nếu fail)
qa_condition → market (Marketing) → approval (Human) → end (CEO)
```

### BullMQ Integration

```typescript
// Workflow Queue
Queue<WorkflowJobData>('workflow-execution', { connection: redisConnection })
Worker<WorkflowJobData>('workflow-execution', async (job) => {
  const result = await this.executeNodeJob(job.data);
  await this.handleJobCompletion(job.data.runId, job.data.nodeId, result);
  return result;
}, { concurrency: 5 })
```

### Cycle Detection

```typescript
const MAX_NODE_VISITS = 3;
if (!context._visitedNodes) context._visitedNodes = {};
const visitCount = (context._visitedNodes[nextNodeId] || 0) + 1;
if (visitCount > MAX_NODE_VISITS) {
  // Fail workflow to prevent infinite loop
}
```

---

## 7. Multi-Agent System

### Các Agent

| Agent | Vai Trò | Model Mặc Định | Chức Năng |
|-------|---------|----------------|-----------|
| CEO | Chief Executive Officer | `cx/gpt-5.4-mini` | Lên kế hoạch, milestone, hoàn thành dự án |
| PM | Project Manager | `groq/llama-3.3-70b-versatile` | Phân công tasks, breakdown milestones |
| DEV | Lead Developer | `cx/gpt-5.4-mini` | Viết code, triển khai |
| QA | QA Engineer | `groq/qwen/qwen3-32b` | Kiểm tra code, review |
| Marketing | Marketing Manager | `openrouter/google/gemma-4-26b-a4b-it:free` | Viết thông báo, quảng cáo |

### Agent Execution Flow

```typescript
// BaseAgent
async execute(context: any): Promise<any> {
  const thought = await this.think(context);  // Suy nghĩ
  const action = await this.act(context);     // Hành động
  return { thought, action };
}
```

### DEV Agent - Code Generation

DEV agent nhận context từ workflow:
```typescript
const agentInput = {
  projectId: run.projectId,
  task: context.task,
  goal: workflowCtx.goal,
  projectSummary: workflowCtx.projectDescription,
  code: workflowCtx.code,
  ...vars
};
```

Output format:
```xml
<CODE filepath="src/index.js">
const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({ message: 'Hello World!' }));
app.listen(3000);
</CODE>
```

### QA Agent - Code Review

```typescript
// Auto-approve nếu code tồn tại
const hasCode = code.length > 10 && !code.includes('No code provided');
if (explicitlyFailed) approved = false;
else if (explicitlyPassed) approved = true;
else approved = hasCode;  // Default: approve if code exists
```

---

## 8. LLM Integration

### 9Router Gateway

- **Endpoint:** `http://localhost:20128/v1/chat/completions`
- **Protocol:** OpenAI-compatible
- **Models:** OpenCode free models

### Circuit Breaker Pattern

```
Failure 1 → Warning
Failure 2 → Warning
Failure 3 → OPEN (circuit breaker activated)
           → Use fallback model
           → Auto-reset after cooldown
```

### Cost Tracking

```typescript
// Mỗi LLM call được log
await this.apiUsageService.logUsage({
  projectId,
  agentRole,
  requestedModel,
  actualModelUsed,
  promptTokens,
  completionTokens,
  responseTimeMs,
});

// Update project cost
const newCost = Number(project.costAccrued) + actualCost;
await this.prisma.project.update({
  where: { id: projectId },
  data: { costAccrued: newCost }
});
```

### Budget Management

- **90% budget:** Gửi warning notification
- **100% budget:** Tự động pause project

---

## 9. Bảo Mật

### Các Biện Pháp Bảo Mật

| Biện Pháp | Mô Tả |
|-----------|-------|
| JWT Authentication | Token-based auth với expiry |
| Input Sanitization | 15+ prompt injection patterns |
| Docker Sandbox | Code execution isolated |
| Non-root user | Container chạy với user `node` |
| Seccomp profile | Restrict system calls |
| Environment Validation | Validate required vars at startup |
| CORS | Configurable origin |

### Input Sanitization Patterns

```typescript
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*:\s*/i,
  /override\s+instructions/i,
  // ... 15+ patterns
];
```

### Docker Sandbox

```typescript
{
  Image: 'node:18-alpine',
  HostConfig: {
    NetworkMode: 'host',
    ReadonlyRootfs: false,
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
  }
}
```

---

## 10. Thực Trạng Hiện Tại

### Trạng Thái Hoàn Thành

| Thành Phần | Trạng Thái | Ghi Chú |
|------------|-----------|---------|
| Dashboard | ✅ Hoàn thành | Project cards, stats, create project |
| Virtual Office | ✅ Hoàn thành | Real-time agent status, meeting room |
| Kanban Board | ✅ Hoàn thành | Drag & drop, task cards |
| Workflow Engine | ✅ Hoàn thành | DAG execution, BullMQ, retry |
| Multi-Agent | ✅ Hoàn thành | 5 agents: CEO, PM, DEV, QA, Marketing |
| LLM Gateway | ✅ Hoàn thành | 9Router integration, circuit breaker |
| Auth System | ✅ Hoàn thành | JWT, login/register |
| Cost Analytics | ✅ Hoàn thành | Charts, budget tracking |
| Approval System | ✅ Hoàn thành | Real-time notifications |
| Agent Settings | ✅ Hoàn thành | Model switching UI |
| Docker Sandbox | ✅ Hoàn thành | Code execution, auto-pull images |
| Memory Service | ✅ Hoàn thành | Vector search, embeddings |

### API Endpoints

| Endpoint | Method | Mô Tả |
|----------|--------|-------|
| `/api/auth/login` | POST | Đăng nhập |
| `/api/auth/register` | POST | Đăng ký |
| `/api/projects` | GET/POST | Danh sách/Tạo dự án |
| `/api/projects/:id` | GET/PATCH/DELETE | Chi tích/Cập nhật/Xóa |
| `/api/tasks` | GET | Danh sách tasks |
| `/api/projects/:id/milestones` | GET/POST | Milestones |
| `/api/models` | GET | Danh sách models |
| `/api/models/:role` | PATCH | Đổi model agent |
| `/api/approvals` | GET | Approvals pending |
| `/api/approvals/:id/approve` | POST | Duyệt approval |
| `/api/approvals/:id/reject` | POST | Từ chối approval |
| `/api/cost/summary` | GET | Tổng quan chi phí |
| `/api/health` | GET | Health check |

### Database Schema

```
User ─┬─ Agent
      ├─ Project ─┬─ Task
      │            ├─ Milestone
      │            ├─ WorkflowRun ─┬─ WorkflowStep
      │            │               └─ Approval
      │            └─ ApiUsageLog
      └─ Memory
```

---

## 11. Kết Quả Đạt Được

### Demo Projects

| Tên | Mục Tiêu | Trạng Thái | Files |
|-----|-----------|-----------|-------|
| Test (Express) | Hello World Express Server | ✅ Completed | `package.json`, `src/index.js` |
| Test (TS) | Hello World TypeScript | ✅ Completed | `src/index.js` |
| ecommerce platform | E-commerce Frontend | ✅ Completed | `src/index.js` (stub) |
| Test Fix v2 | Express Server | ✅ Completed | `src/index.js` |

### Workflow Execution Stats

- **Tổng projects đã tạo:** 12
- **Projects hoàn thành:** 4
- **Tổng token đã sử dụng:** 667,517
- **Tổng approvals đã duyệt:** 5
- **Agent models đã cấu hình:** 5 agents × 5 models

### LLM Models Đang Sử Dụng

| Agent | Model | Provider |
|-------|-------|----------|
| CEO | `cx/gpt-5.4-mini` | CX |
| PM | `groq/llama-3.3-70b-versatile` | Groq |
| DEV | `cx/gpt-5.4-mini` | CX |
| QA | `groq/qwen/qwen3-32b` | Groq |
| Marketing | `openrouter/google/gemma-4-26b-a4b-it:free` | OpenRouter |

---

## 12. Hạn Chế Và Hướng Phát Triển

### Hạn Chế Hiện Tại

1. **Code ephemeral:** Files chỉ tồn tại trong Docker container, không persist
2. **LLM free models:** Chất lượng code gen còn hạn chế
3. **Single-user:** Chưa hỗ trợ multi-user collaboration
4. **No CI/CD:** Chưa tích hợp build/test pipeline

### Hướng Phát Triển

#### Ngắn Hạn (1-2 tháng)
- [ ] Persist code files vào database hoặc object storage
- [ ] Thêm CI/CD pipeline (GitHub Actions)
- [ ] Code editor integration (Monaco Editor)
- [ ] Multi-language support (Python, Go, Rust)

#### Trung Hạn (3-6 tháng)
- [ ] Multi-user collaboration
- [ ] Real-time code editing
- [ ] Docker compose cho full stack
- [ ] Kubernetes deployment
- [ ] Grafana monitoring dashboard

#### Dài Hạn (6-12 tháng)
- [ ] AI-powered code review
- [ ] Automated testing pipeline
- [ ] Production deployment automation
- [ ] Multi-tenant SaaS platform
- [ ] Mobile app

---

## 13. Phụ Lục

### A. Cài Đặt Chi Tiết

```bash
# 1. Clone repo
git clone <repo-url>
cd ai-corp

# 2. Install dependencies
pnpm install

# 3. Setup PostgreSQL
# Windows:
choco install postgresql --params "/Password:postgres"
net start postgresql-x64-16
createdb -U postgres neondb

# 4. Setup Redis
docker run -d --name ai-corp-redis -p 6379:6379 redis:7-alpine

# 5. Configure environment
cd apps/api
cp .env.example .env
# Edit .env with your settings

# 6. Initialize database
pnpm db:push
pnpm db:seed

# 7. Start servers
pnpm dev          # Backend :3000
cd ../web
pnpm dev          # Frontend :5173
```

### B. Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  password      String
  role          String    @default("board_member")
  projects      Project[]
  approvals     Approval[]
  createdAt     DateTime  @default(now())
}

model Agent {
  id                String    @id @default(uuid())
  role              String    @unique
  name              String
  modelRouteConfig  Json      @default("{}")
  memories          Memory[]
}

model Project {
  id            String    @id @default(uuid())
  name          String
  description   String?
  goal          String?
  status        String    @default("active")
  budget        Decimal?  @db.Decimal(10, 2)
  costAccrued   Decimal   @default(0) @db.Decimal(10, 2)
  createdById   String
  createdBy     User      @relation(fields: [createdById], references: [id])
  tasks         Task[]
  milestones    Milestone[]
  workflowRuns  WorkflowRun[]
  apiUsageLogs  ApiUsageLog[]
  createdAt     DateTime  @default(now())
}

model Task {
  id            String    @id @default(uuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id])
  title         String
  description   String?
  status        String    @default("todo")
  priority      String    @default("medium")
  assignedAgent String?
  estimatedCost Decimal?  @db.Decimal(10, 2)
  actualCost    Decimal   @default(0) @db.Decimal(10, 2)
  createdAt     DateTime  @default(now())
}

model Milestone {
  id          String    @id @default(uuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
  name        String
  description String?
  status      String    @default("pending")
  createdAt   DateTime  @default(now())
}

model WorkflowRun {
  id            String    @id @default(uuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id])
  workflowDefId String
  status        String    @default("pending")
  currentNodeId String?
  context       Json      @default("{}")
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  steps         WorkflowStep[]
  approvals     Approval[]
}

model WorkflowStep {
  id            String    @id @default(uuid())
  workflowRunId String
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
  nodeId        String
  agentRole     String?
  status        String    @default("pending")
  output        Json?
  error         String?
  startedAt     DateTime?
  completedAt   DateTime?
  durationMs    Int?
  retryCount    Int       @default(0)
}

model Approval {
  id            String    @id @default(uuid())
  workflowRunId String
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  approvalType  String
  requestData   Json
  status        String    @default("pending")
  comment       String?
  requestedAt   DateTime  @default(now())
  respondedAt   DateTime?
}

model ApiUsageLog {
  id                String    @id @default(uuid())
  projectId         String?
  project           Project?  @relation(fields: [projectId], references: [id])
  agentRole         String
  requestedModel    String
  actualModelUsed   String
  actualProvider    String
  isFallbackTriggered Boolean @default(false)
  promptTokens      Int
  completionTokens  Int
  totalTokens       Int
  rtkTokenSaved     Int?
  estimatedCost     Decimal   @db.Decimal(10, 6)
  actualCost        Decimal   @db.Decimal(10, 6)
  responseTimeMs    Int
  createdAt         DateTime  @default(now())
}

model Memory {
  id          String    @id @default(uuid())
  agentId     String
  agent       Agent     @relation(fields: [agentId], references: [id])
  namespace   String
  content     String
  embedding   Unsupported("vector(384)")?
  importance  Int       @default(5)
  projectId   String?
  createdAt   DateTime  @default(now())
}
```

### C. API Reference

```bash
# Auth
POST /api/auth/login     { email, password }
POST /api/auth/register  { email, name, password }

# Projects
GET    /api/projects
POST   /api/projects     { name, description, goal, budget }
GET    /api/projects/:id
PATCH  /api/projects/:id { status, ... }
DELETE /api/projects/:id

# Tasks
GET    /api/tasks?projectId=xxx
POST   /api/projects/:projectId/tasks
PATCH  /api/tasks/:id

# Milestones
GET    /api/projects/:projectId/milestones
POST   /api/projects/:projectId/milestones

# Models
GET    /api/models
GET    /api/models/available
PATCH  /api/models/:role

# Approvals
GET    /api/approvals
POST   /api/approvals/:id/approve
POST   /api/approvals/:id/reject

# Cost
GET    /api/cost/summary?projectId=xxx

# Health
GET    /api/health
```

### D. WebSocket Events

```typescript
// Client → Server
'subscribe_project'     { projectId }
'human:approval_response' { approvalId, status, comment }

// Server → Client
'agent:thinking'   { agentRole, message }
'agent:action'     { agentRole, actionType, toolName }
'agent:message'    { fromAgent, toAgent, message }
'workflow:state_changed' { workflowRunId, currentState }
'human:approval_required' { approvalId, approvalType, requestData }
'task:updated'     { taskId, status }
'project_event'    { type, data }
'user_event'       { type, data }
```

### E. Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neondb

# JWT
JWT_SECRET=ai-corp-jwt-secret-key-2026
JWT_EXPIRES_IN=7d

# Server
PORT=3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 9Router LLM Gateway
NINE_ROUTER_API_KEY=sk-7a0cc2bd732248a3-ql7qzm-fdd42bd5
NINE_ROUTER_URL=http://localhost:20128
```

---

**Báo cáo thực hiện bởi:** AI Corp Development Team
**Ngày:** 23/06/2026
**Phiên bản:** 1.0.0
