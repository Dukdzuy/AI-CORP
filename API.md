# API Documentation

Base URL: `http://localhost:3000`

All endpoints (except auth and health) require JWT authentication via `Authorization: Bearer <token>` header.

## Authentication

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "board_member",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "board_member",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

## Health

### GET /health
Check system health status (database, 9Router, Redis).

**Response (200):**
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "online", "latencyMs": 5 },
    "ninerouter": { "status": "online", "latencyMs": 120 }
  },
  "timestamp": "2026-06-21T12:00:00.000Z"
}
```

## Projects

### POST /projects
Create a new project. Automatically starts the default workflow.

**Request:**
```json
{
  "name": "E-commerce Platform",
  "description": "Build a full-stack e-commerce platform",
  "goal": "Create a production-ready e-commerce site with cart, checkout, and admin dashboard",
  "budget": 50.00
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "E-commerce Platform",
  "description": "Build a full-stack e-commerce platform",
  "goal": "Create a production-ready e-commerce site...",
  "budget": 50.00,
  "costAccrued": 0,
  "status": "active",
  "createdById": "user-uuid",
  "createdAt": "2026-06-21T12:00:00.000Z"
}
```

### GET /projects/:id
Get project details with milestones and tasks.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "E-commerce Platform",
  "status": "active",
  "milestones": [...],
  "tasks": [...]
}
```

### PATCH /projects/:id
Update project status or details.

**Request:**
```json
{
  "status": "paused"
}
```

**Valid statuses:** `active`, `paused`, `cancelled`, `completed`

## Tasks

### POST /projects/:projectId/tasks
Create a new task in a project.

**Request:**
```json
{
  "title": "Implement user authentication",
  "description": "Add JWT-based auth with login/register",
  "priority": "high",
  "assignedAgent": "DEV",
  "milestoneId": "milestone-uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "projectId": "project-uuid",
  "title": "Implement user authentication",
  "status": "todo",
  "priority": "high",
  "assignedAgent": "DEV"
}
```

### PATCH /tasks/:id
Update task status. Valid transitions:
- `todo` → `in_progress`, `done`
- `in_progress` → `review`, `todo`
- `review` → `done`, `in_progress`
- `done` → `in_progress`

**Request:**
```json
{
  "status": "in_progress"
}
```

## Milestones

### POST /projects/:projectId/milestones
Create a milestone.

**Request:**
```json
{
  "name": "Phase 1: Backend",
  "description": "Complete backend API implementation",
  "dueDate": "2026-07-01T00:00:00.000Z"
}
```

### GET /projects/:projectId/milestones
List all milestones for a project.

### PATCH /milestones/:id
Update milestone status.

**Valid statuses:** `pending`, `in_progress`, `completed`

## WebSocket Events

Connect to `http://localhost:3000` with Socket.IO. Authenticate via JWT token.

### Client Events
| Event | Description |
|-------|-------------|
| `subscribe_project` | Subscribe to project room for real-time updates |

### Server Events
| Event | Description |
|-------|-------------|
| `agent:thinking` | Agent is processing a task |
| `agent:action` | Agent completed an action |
| `agent:message` | Inter-agent communication |
| `task:updated` | Task status changed |
| `workflow:state_changed` | Workflow state transition |
| `human:approval_required` | Approval needed from board member |
| `system_event` | System health alerts |
| `system_notification` | Budget warnings, errors |

### Event Payloads

**agent:thinking**
```json
{
  "type": "agent:thinking",
  "data": {
    "agentId": "CEO",
    "agentRole": "CEO",
    "taskId": "node-1",
    "message": "Analyzing task: planMilestones..."
  },
  "timestamp": "2026-06-21T12:00:00.000Z"
}
```

**workflow:state_changed**
```json
{
  "type": "workflow:state_changed",
  "data": {
    "workflowRunId": "run-uuid",
    "projectId": "project-uuid",
    "previousState": "running",
    "currentState": "completed",
    "currentNodeId": "end",
    "timestamp": "2026-06-21T12:05:00.000Z"
  }
}
```

**human:approval_required**
```json
{
  "type": "human:approval_required",
  "data": {
    "approvalId": "approval-uuid",
    "workflowRunId": "run-uuid",
    "projectId": "project-uuid",
    "approvalType": "project_completion",
    "requestData": { "message": "Ready for final review" },
    "requestedAt": "2026-06-21T12:10:00.000Z"
  }
}
```

## Agent Roles

| Role | Description | Tools |
|------|-------------|-------|
| `CEO` | Strategic planning, milestone creation | create_milestone |
| `PM` | Task breakdown, prioritization | create_task |
| `DEV` | Code implementation, testing | write_file, read_file, run_tests |
| `QA` | Code review, bug detection | read_file, run_tests |
| `MARKETING` | Announcement drafting | - |

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad request / validation error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Internal server error |
