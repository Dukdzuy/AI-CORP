# Requirements Document: AI Corp Platform

## Introduction

AI Corp is a web-based platform that simulates a virtual tech company where all employees are AI Agents powered by Large Language Models (LLMs). The platform automates the complete software development lifecycle: receiving requirements → planning → task breakdown → code implementation → QA review → release → marketing content creation.

Human users act as the "Board of Directors," providing initial goals, approving milestones, and intervening when agents encounter challenges through a human-in-the-loop pattern. The system serves founders, product managers, and technical leaders who want to rapidly prototype product ideas using an autonomous "virtual company" of AI agents.

The key innovation is the integration of 9Router as an LLM gateway providing 3-tier auto-fallback (subscription APIs → cheap APIs → free providers) with RTK Token Saver technology that reduces input tokens by 20-40% through intelligent compression.

## Glossary

- **AI_Corp_Platform**: The complete web-based system including frontend, backend, agents, and infrastructure
- **Agent**: An AI entity powered by an LLM that performs specific roles (CEO, PM, Dev, QA, Marketing)
- **Board_of_Directors**: Human users who provide goals, approve milestones, and intervene in agent workflows
- **Workflow_Engine**: DAG-based orchestration system that manages agent task execution and state transitions
- **Nine_Router**: External LLM gateway service providing 3-tier auto-fallback and token compression
- **Sandbox_Executor**: Docker-based isolated execution environment for agent tools
- **Memory_Service**: Vector-based long-term memory storage using pgvector for semantic search
- **WebSocket_Gateway**: Real-time bidirectional communication system for agent activity updates
- **Tool**: A function that agents can execute (e.g., write_file, run_tests, create_milestone)
- **Project**: A user-submitted goal with associated milestones, tasks, and workflow execution
- **Workflow_Run**: A single execution instance of a workflow definition
- **Workflow_Step**: A single node execution within a workflow run
- **Agent_Memory**: A stored piece of knowledge with vector embedding for semantic search
- **Circuit_Breaker**: Pattern that automatically switches to fallback provider after consecutive failures
- **Resource_Limits**: Constraints on CPU, memory, disk, and network for sandbox execution
- **LLM_Provider**: Service that provides large language model API access (9Router, Anthropic, OpenAI)
- **Approval**: Human-in-the-loop decision point requiring Board member intervention

## Requirements

### Requirement 1: Project Management

**User Story:** As a Board member, I want to create projects with goals and track their progress, so that I can manage the virtual company's workload.

#### Acceptance Criteria

1. WHEN a Board member submits a project with a name, description, and goal, THE AI_Corp_Platform SHALL create a project record with unique identifier
2. WHEN a Board member provides an optional budget for a project, THE AI_Corp_Platform SHALL validate the budget is positive
3. WHEN a project is created, THE AI_Corp_Platform SHALL initialize the project status as "active"
4. WHEN a Board member requests project details, THE AI_Corp_Platform SHALL return all milestones, tasks, and cost information
5. WHILE a project is active, THE AI_Corp_Platform SHALL track accumulated costs from agent LLM usage
6. WHEN a Board member updates project status to paused or cancelled, THE AI_Corp_Platform SHALL halt all running workflows for that project

### Requirement 2: Workflow Orchestration

**User Story:** As the system, I want to orchestrate agent tasks using DAG-based workflows, so that work flows correctly between agents.

#### Acceptance Criteria

1. WHEN a workflow is started with a workflow definition, THE Workflow_Engine SHALL validate the definition contains no cycles
2. WHEN a workflow execution begins, THE Workflow_Engine SHALL create a workflow run record with status "running"
3. WHILE a workflow run has status "running", THE Workflow_Engine SHALL maintain exactly one pending or running workflow step for the current node
4. WHEN a workflow node completes successfully, THE Workflow_Engine SHALL transition to the next node based on success conditions
5. WHEN a workflow node fails, THE Workflow_Engine SHALL transition to the failure node if specified, otherwise mark workflow as failed
6. WHEN a workflow reaches the end node, THE Workflow_Engine SHALL update workflow run status to "completed"
7. WHEN a workflow step fails and retry count is below maximum, THE Workflow_Engine SHALL retry the step with exponential backoff
8. WHEN a workflow is paused, THE Workflow_Engine SHALL persist current state and cease execution
9. WHEN a paused workflow is resumed, THE Workflow_Engine SHALL continue from the last saved node

### Requirement 3: Agent Lifecycle Management

**User Story:** As the system, I want to manage agent execution lifecycle, so that agents can think, act, and learn from their work.

#### Acceptance Criteria

1. WHEN an agent is invoked with a task context, THE Agent SHALL load relevant memories from its namespace using semantic search
2. WHEN an agent thinks about a task, THE Agent SHALL call the configured LLM provider with system prompt and context
3. WHEN an agent receives a thought from the LLM, THE Agent SHALL parse planned tool actions from the response
4. WHEN an agent acts on planned actions, THE Agent SHALL execute each tool sequentially and collect results
5. WHEN an agent completes a task successfully, THE Agent SHALL save learnings to long-term memory with importance rating
6. IF an agent task fails with a retryable error, THEN THE Agent SHALL allow workflow engine to retry up to maximum retry count
7. WHEN agent execution begins or completes, THE Agent SHALL emit WebSocket events for real-time UI updates

### Requirement 4: LLM Gateway Integration

**User Story:** As the system, I want to route LLM requests through 9Router with automatic fallback, so that I have reliable LLM access with cost optimization.

#### Acceptance Criteria

1. WHEN an agent makes an LLM call with a model specification, THE LLM_Gateway SHALL check Nine_Router health status
2. WHEN Nine_Router health status is "online", THE LLM_Gateway SHALL route the request to Nine_Router
3. WHEN Nine_Router has 3 or more consecutive failures, THE LLM_Gateway SHALL route requests to the configured fallback provider
4. WHEN an LLM response is received, THE LLM_Gateway SHALL extract the actual model used and provider name
5. WHEN an LLM call completes, THE LLM_Gateway SHALL log token usage, costs, and RTK tokens saved
6. WHEN calculating costs, THE LLM_Gateway SHALL use the actual model used, not the requested model
7. WHEN Nine_Router is unreachable, THE LLM_Gateway SHALL increment the consecutive failures counter
8. WHEN Nine_Router responds successfully after failures, THE LLM_Gateway SHALL reset the consecutive failures counter to zero

### Requirement 5: Circuit Breaker Pattern

**User Story:** As the system, I want automatic failover when the primary LLM provider is unavailable, so that workflows continue without manual intervention.

#### Acceptance Criteria

1. THE LLM_Gateway SHALL perform periodic health checks on Nine_Router
2. WHEN a health check fails, THE LLM_Gateway SHALL increment the consecutive failures counter
3. WHEN consecutive failures reach 3, THE LLM_Gateway SHALL open the circuit breaker and use fallback provider
4. WHILE the circuit breaker is open, THE LLM_Gateway SHALL route all requests to the fallback provider
5. WHEN a health check succeeds after circuit breaker is open, THE LLM_Gateway SHALL close the circuit breaker and resume using Nine_Router
6. WHEN circuit breaker state changes, THE LLM_Gateway SHALL update the gateway status record in the database

### Requirement 6: Tool Execution and Sandbox Isolation

**User Story:** As the system, I want to execute agent tools in isolated containers with resource limits, so that malicious or buggy code cannot compromise the host system.

#### Acceptance Criteria

1. WHEN an agent executes a tool marked as requiring sandbox, THE Sandbox_Executor SHALL create an ephemeral Docker container
2. WHEN a container is created, THE Sandbox_Executor SHALL enforce memory limits specified in resource constraints
3. WHEN a container is created, THE Sandbox_Executor SHALL enforce CPU limits specified in resource constraints
4. WHEN a container is created, THE Sandbox_Executor SHALL mount the root filesystem as read-only
5. WHEN a container is created, THE Sandbox_Executor SHALL run processes as a non-root user
6. WHEN tool execution time exceeds the timeout, THE Sandbox_Executor SHALL forcefully terminate the container
7. WHEN tool execution completes or fails, THE Sandbox_Executor SHALL clean up the container and collect resource usage metrics
8. WHEN a tool attempts to exceed memory limits, THE Sandbox_Executor SHALL return a resource exhaustion error
9. THE Sandbox_Executor SHALL prevent containers from accessing the host filesystem or Docker socket

### Requirement 7: Vector Memory System

**User Story:** As an agent, I want to store and recall past learnings using semantic search, so that I can improve over time and remember company conventions.

#### Acceptance Criteria

1. WHEN an agent saves a memory, THE Memory_Service SHALL generate a vector embedding for the content
2. WHEN an agent saves a memory, THE Memory_Service SHALL store the memory with agent role, namespace, and importance rating
3. WHEN an agent searches for memories with a query, THE Memory_Service SHALL generate a query embedding
4. WHEN searching memories, THE Memory_Service SHALL perform vector similarity search using cosine distance
5. WHEN searching memories, THE Memory_Service SHALL filter results by agent role to enforce namespace isolation
6. WHEN searching memories, THE Memory_Service SHALL return only memories with similarity score >= 0.7
7. WHEN searching memories, THE Memory_Service SHALL rank results combining similarity (70%) and importance (30%)
8. WHEN an agent searches memories, THE Memory_Service SHALL return at most the specified limit of results

### Requirement 8: Agent Memory Isolation

**User Story:** As the system, I want to ensure agents can only access their own memories, so that different agent roles maintain separate knowledge bases.

#### Acceptance Criteria

1. WHEN an agent of role R1 searches for memories, THE Memory_Service SHALL return only memories where agent_role equals R1
2. WHEN an agent of role R2 searches the same namespace, THE Memory_Service SHALL not return memories created by role R1
3. THE Memory_Service SHALL index memories by agent role and namespace for efficient filtering

### Requirement 9: Real-time Communication

**User Story:** As a Board member, I want to see live agent activity and messages, so that I can monitor progress in real-time.

#### Acceptance Criteria

1. WHEN a client connects to the WebSocket server, THE WebSocket_Gateway SHALL authenticate the connection using JWT
2. WHEN a client subscribes to a project channel, THE WebSocket_Gateway SHALL add the client to that project's room
3. WHEN an agent begins thinking, THE WebSocket_Gateway SHALL broadcast an "agent:thinking" event to the project room
4. WHEN an agent sends a message, THE WebSocket_Gateway SHALL broadcast an "agent:message" event to the project room
5. WHEN a task status changes, THE WebSocket_Gateway SHALL broadcast a "task:updated" event to the project room
6. WHEN a workflow state changes, THE WebSocket_Gateway SHALL broadcast a "workflow:state_changed" event to the project room
7. WHEN human approval is required, THE WebSocket_Gateway SHALL send a "human:approval_required" event to the project owner
8. WHEN a client disconnects, THE WebSocket_Gateway SHALL remove the client from all subscribed rooms

### Requirement 10: Human-in-the-Loop Approvals

**User Story:** As a Board member, I want to approve critical milestones and decisions, so that I maintain control over the virtual company.

#### Acceptance Criteria

1. WHEN a workflow reaches a human approval node, THE Workflow_Engine SHALL create an approval request with status "pending"
2. WHEN an approval request is created, THE Workflow_Engine SHALL pause workflow execution at that node
3. WHEN an approval request is created, THE Workflow_Engine SHALL emit a WebSocket notification to the project owner
4. WHEN a Board member approves a request, THE Workflow_Engine SHALL update approval status to "approved" and resume workflow
5. WHEN a Board member rejects a request, THE Workflow_Engine SHALL update approval status to "rejected" and transition to rejection node
6. WHEN an approval response is received, THE Workflow_Engine SHALL record the response timestamp and optional comment

### Requirement 11: Cost Tracking and Budget Management

**User Story:** As a Board member, I want accurate cost tracking for LLM usage, so that I can manage project budgets.

#### Acceptance Criteria

1. WHEN an LLM call completes, THE LLM_Gateway SHALL log the actual model used, token counts, and calculated cost
2. WHEN calculating cost, THE LLM_Gateway SHALL use pricing for the actual model returned, not the requested model
3. WHEN Nine_Router uses a fallback model, THE LLM_Gateway SHALL mark isFallbackTriggered as true
4. WHEN Nine_Router compresses tokens using RTK, THE LLM_Gateway SHALL record the number of tokens saved
5. WHEN a project budget is set, THE AI_Corp_Platform SHALL accumulate actual costs as agents execute tasks
6. WHEN accumulated costs approach the project budget (within 10%), THE AI_Corp_Platform SHALL send a warning notification
7. IF accumulated costs exceed the project budget, THEN THE AI_Corp_Platform SHALL pause the project and request Board approval to continue

### Requirement 12: Task Management and Kanban Board

**User Story:** As a Board member and as agents, we want to track tasks on a Kanban board, so that work progress is visible.

#### Acceptance Criteria

1. WHEN a PM Agent creates tasks, THE AI_Corp_Platform SHALL initialize each task with status "todo"
2. WHEN a Dev Agent begins work on a task, THE AI_Corp_Platform SHALL update task status to "in_progress"
3. WHEN a Dev Agent completes work, THE AI_Corp_Platform SHALL update task status to "review"
4. WHEN a QA Agent approves a task, THE AI_Corp_Platform SHALL update task status to "done"
5. WHEN task status changes, THE AI_Corp_Platform SHALL validate the transition follows Kanban rules: todo → in_progress → review → done
6. WHEN a task is created, THE AI_Corp_Platform SHALL allow assignment to a specific agent role
7. WHEN a task is updated, THE AI_Corp_Platform SHALL record estimated cost and actual cost separately

### Requirement 13: Workflow DAG Validation

**User Story:** As the system, I want to validate workflow definitions are acyclic, so that workflows always terminate and don't loop infinitely.

#### Acceptance Criteria

1. WHEN a workflow definition is created, THE Workflow_Engine SHALL validate the graph structure is a directed acyclic graph (DAG)
2. WHEN validating a workflow, THE Workflow_Engine SHALL use cycle detection algorithm to check for cycles
3. IF a workflow definition contains a cycle, THEN THE Workflow_Engine SHALL reject the definition with a validation error
4. WHEN a workflow is started, THE Workflow_Engine SHALL verify start node and end node exist in the definition

### Requirement 14: State Persistence and Recovery

**User Story:** As the system, I want to persist workflow state, so that executions can recover from crashes or be paused and resumed.

#### Acceptance Criteria

1. WHEN a workflow step begins, THE Workflow_Engine SHALL save the step record with status "running"
2. WHEN a workflow step completes, THE Workflow_Engine SHALL save the output and update status to "completed"
3. WHEN a workflow step fails, THE Workflow_Engine SHALL save the error message and update status to "failed"
4. WHEN a workflow is paused, THE Workflow_Engine SHALL persist the current node ID and workflow context
5. WHEN the system restarts, THE Workflow_Engine SHALL reload running workflows from the database
6. WHEN resuming a workflow, THE Workflow_Engine SHALL continue execution from the saved current node

### Requirement 15: Agent Configuration and System Prompts

**User Story:** As an administrator, I want to configure agents with specific models and prompts, so that I can customize agent behavior.

#### Acceptance Criteria

1. THE AI_Corp_Platform SHALL maintain one agent configuration record per agent role (CEO, PM, DEV, QA, MARKETING)
2. WHEN an agent configuration is updated, THE AI_Corp_Platform SHALL store the system prompt as text
3. WHEN an agent configuration is updated, THE AI_Corp_Platform SHALL store the model route configuration as JSON
4. WHEN an agent is invoked, THE AI_Corp_Platform SHALL load the agent configuration and use the specified model and system prompt
5. WHEN an agent is marked as inactive, THE AI_Corp_Platform SHALL not allow that agent to be invoked in workflows

### Requirement 16: Authentication and Authorization

**User Story:** As a Board member, I want secure access to my projects, so that other users cannot view or modify my work.

#### Acceptance Criteria

1. WHEN a user registers, THE AI_Corp_Platform SHALL hash the password using bcrypt with at least 12 salt rounds
2. WHEN a user logs in with valid credentials, THE AI_Corp_Platform SHALL issue a JWT token with 1 hour expiration
3. WHEN a user logs in, THE AI_Corp_Platform SHALL issue a refresh token with 7 day expiration
4. WHEN a user accesses a project, THE AI_Corp_Platform SHALL verify the user is the project owner
5. WHEN a user attempts to approve a request, THE AI_Corp_Platform SHALL verify the user has "board_member" role
6. WHEN a WebSocket connection is established, THE AI_Corp_Platform SHALL validate the JWT token before accepting the connection

### Requirement 17: Database Validation and Constraints

**User Story:** As the system, I want to enforce data integrity rules, so that the database remains consistent.

#### Acceptance Criteria

1. THE AI_Corp_Platform SHALL enforce that Agent.role is unique across all agents
2. THE AI_Corp_Platform SHALL enforce that Project.budget is positive when provided
3. THE AI_Corp_Platform SHALL enforce that AgentMemory.importance is between 1 and 10 inclusive
4. THE AI_Corp_Platform SHALL enforce that ApiUsageLog.totalTokens equals promptTokens plus completionTokens
5. THE AI_Corp_Platform SHALL enforce that ApiUsageLog.rtkTokenSaved is non-negative and does not exceed promptTokens
6. THE AI_Corp_Platform SHALL enforce that WorkflowStep.completedAt is after startedAt when both are set
7. THE AI_Corp_Platform SHALL enforce that Approval.status can only transition from "pending" to "approved" or "rejected"

### Requirement 18: Tool Registry and Role-Based Access

**User Story:** As the system, I want to control which tools each agent role can access, so that agents have appropriate capabilities.

#### Acceptance Criteria

1. WHEN a tool is registered, THE AI_Corp_Platform SHALL store the tool definition with name, description, and parameter schema
2. WHEN registering a tool, THE AI_Corp_Platform SHALL specify which agent roles can execute it
3. WHEN an agent attempts to execute a tool, THE AI_Corp_Platform SHALL verify the agent's role is authorized for that tool
4. WHEN an agent loads available tools, THE AI_Corp_Platform SHALL return only tools authorized for that agent's role

### Requirement 19: Error Handling and Retry Logic

**User Story:** As the system, I want to gracefully handle errors and retry transient failures, so that workflows are resilient to temporary issues.

#### Acceptance Criteria

1. WHEN a workflow step fails with a retryable error, THE Workflow_Engine SHALL retry up to the maximum retry count
2. WHEN retrying a failed step, THE Workflow_Engine SHALL wait for exponential backoff period: 2^retryCount seconds
3. WHEN a step exceeds maximum retries, THE Workflow_Engine SHALL mark the workflow as failed
4. WHEN an LLM provider call fails with a transient error, THE LLM_Gateway SHALL retry up to 3 times
5. WHEN a sandbox tool execution times out, THE Sandbox_Executor SHALL return an error result rather than throwing an exception
6. WHEN embedding generation fails, THE Memory_Service SHALL return empty results rather than failing the agent task

### Requirement 20: Logging and Observability

**User Story:** As an administrator, I want comprehensive logging of all LLM calls and agent actions, so that I can debug issues and analyze costs.

#### Acceptance Criteria

1. WHEN an LLM call is made, THE LLM_Gateway SHALL log the requested model, actual model, provider, token usage, and cost
2. WHEN an agent executes a tool, THE AI_Corp_Platform SHALL log the tool name, parameters, execution time, and result
3. WHEN a workflow step completes, THE Workflow_Engine SHALL log the step outcome and any error messages
4. WHEN circuit breaker state changes, THE LLM_Gateway SHALL log the state transition with timestamp
5. WHEN Nine_Router RTK compression is used, THE LLM_Gateway SHALL log the number of tokens saved
6. WHEN an agent saves a memory, THE Memory_Service SHALL log the namespace, importance, and embedding generation time

### Requirement 21: Frontend Dashboard and Visualization

**User Story:** As a Board member, I want a dashboard to view projects, monitor agent activity, and approve decisions, so that I can manage the virtual company effectively.

#### Acceptance Criteria

1. WHEN a Board member loads the dashboard, THE AI_Corp_Platform SHALL display all projects with status and cost information
2. WHEN a Board member views a project, THE AI_Corp_Platform SHALL display a Kanban board with tasks in their current status columns
3. WHEN a Board member views a project, THE AI_Corp_Platform SHALL display a virtual office view with agent activity
4. WHEN agents are thinking or sending messages, THE AI_Corp_Platform SHALL update the UI in real-time via WebSocket
5. WHEN an approval is required, THE AI_Corp_Platform SHALL display a notification with approval details
6. WHEN a Board member clicks approve or reject, THE AI_Corp_Platform SHALL submit the response and resume the workflow

### Requirement 22: Monorepo Structure and Build System

**User Story:** As a developer, I want a well-organized monorepo with shared types and configurations, so that the codebase is maintainable.

#### Acceptance Criteria

1. THE AI_Corp_Platform SHALL organize code in a monorepo with apps/ for frontend and backend, and packages/ for shared code
2. THE AI_Corp_Platform SHALL use pnpm workspaces for dependency management
3. THE AI_Corp_Platform SHALL use Turbo for parallel build and test execution
4. THE AI_Corp_Platform SHALL define shared TypeScript types in a shared-types package
5. THE AI_Corp_Platform SHALL import shared types into both frontend and backend to ensure type consistency

### Requirement 23: Docker Compose Development Environment

**User Story:** As a developer, I want a Docker Compose setup for local development, so that I can run all dependencies easily.

#### Acceptance Criteria

1. THE AI_Corp_Platform SHALL provide a docker-compose.yml file that starts PostgreSQL with pgvector extension
2. THE AI_Corp_Platform SHALL provide a docker-compose.yml file that starts Redis for caching and queues
3. THE AI_Corp_Platform SHALL provide a docker-compose.yml file that starts Nine_Router gateway on localhost:20128
4. WHEN docker-compose is started, THE AI_Corp_Platform SHALL initialize the PostgreSQL database with required extensions and schema
5. WHEN docker-compose is started, THE AI_Corp_Platform SHALL expose service ports for local development access

### Requirement 24: Health Monitoring and Status Checks

**User Story:** As an administrator, I want to monitor system health and service availability, so that I can proactively address issues.

#### Acceptance Criteria

1. THE LLM_Gateway SHALL perform health checks on Nine_Router every 30 seconds
2. WHEN a health check is performed, THE LLM_Gateway SHALL update the gateway status record with timestamp
3. WHEN a health check succeeds, THE LLM_Gateway SHALL update status to "online"
4. WHEN a health check fails, THE LLM_Gateway SHALL update status to "offline" or "degraded" based on error type
5. THE AI_Corp_Platform SHALL expose a /health endpoint that returns status of all critical services
6. THE AI_Corp_Platform SHALL display service health status on the admin dashboard

### Requirement 25: Security and Input Validation

**User Story:** As the system, I want to validate and sanitize all inputs, so that the platform is secure against injection attacks.

#### Acceptance Criteria

1. WHEN user input is received, THE AI_Corp_Platform SHALL sanitize potential prompt injection patterns
2. WHEN tool parameters are provided, THE AI_Corp_Platform SHALL validate them against the tool's parameter schema
3. WHEN tool output is included in prompts, THE AI_Corp_Platform SHALL sanitize executable code markers
4. WHEN creating Docker containers, THE AI_Corp_Platform SHALL apply seccomp and AppArmor security profiles
5. THE AI_Corp_Platform SHALL never expose API keys or secrets to the frontend
6. THE AI_Corp_Platform SHALL store all secrets in environment variables, never in source code

### Requirement 26: Performance Optimization

**User Story:** As the system, I want to optimize performance for LLM calls, database queries, and vector search, so that the platform is responsive.

#### Acceptance Criteria

1. WHEN Nine_Router is used, THE LLM_Gateway SHALL benefit from RTK token compression reducing input tokens by 20-40%
2. WHEN searching agent memories, THE Memory_Service SHALL use pgvector index for fast similarity search
3. WHEN loading workflow state, THE Workflow_Engine SHALL cache context in Redis to avoid repeated database reads
4. WHEN multiple workflow nodes are independent, THE Workflow_Engine SHALL execute them in parallel
5. WHEN querying task lists, THE AI_Corp_Platform SHALL use database indexes on project_id and status
6. THE AI_Corp_Platform SHALL target P95 latency of less than 2 seconds for agent actions
7. THE AI_Corp_Platform SHALL target memory search latency of less than 50ms for 10K memories

### Requirement 27: Resource Monitoring and Cleanup

**User Story:** As the system, I want to monitor resource usage and clean up containers, so that the platform doesn't leak resources.

#### Acceptance Criteria

1. WHEN a sandbox container is created, THE Sandbox_Executor SHALL set a unique identifier for tracking
2. WHEN a sandbox container execution completes, THE Sandbox_Executor SHALL collect CPU and memory usage metrics
3. WHEN a sandbox container execution completes or fails, THE Sandbox_Executor SHALL ensure the container is deleted
4. WHEN a workflow step completes, THE Workflow_Engine SHALL record execution time in the step record
5. THE AI_Corp_Platform SHALL provide a cleanup job that removes orphaned containers older than 1 hour
6. THE Memory_Service SHALL provide a pruning function that deletes memories older than retention period by agent role

### Requirement 28: API Usage Analytics

**User Story:** As a Board member, I want to view analytics on LLM usage and costs, so that I can optimize spending.

#### Acceptance Criteria

1. WHEN viewing project details, THE AI_Corp_Platform SHALL display total token usage by agent role
2. WHEN viewing project details, THE AI_Corp_Platform SHALL display estimated vs actual costs showing fallback impact
3. WHEN viewing project details, THE AI_Corp_Platform SHALL display RTK tokens saved if Nine_Router was used
4. WHEN viewing project details, THE AI_Corp_Platform SHALL display which models were actually used vs requested
5. THE AI_Corp_Platform SHALL provide a cost breakdown chart showing costs per agent role over time
6. THE AI_Corp_Platform SHALL calculate cost per task and display on task details

### Requirement 29: Fallback Provider Configuration

**User Story:** As an administrator, I want to configure fallback providers for each agent, so that I have control over cost and reliability tradeoffs.

#### Acceptance Criteria

1. WHEN configuring an agent, THE AI_Corp_Platform SHALL accept a model route configuration specifying primary provider
2. WHEN configuring an agent, THE AI_Corp_Platform SHALL accept an optional fallback provider in the model route configuration
3. WHEN no fallback provider is specified, THE AI_Corp_Platform SHALL default to "anthropic-direct"
4. WHEN the circuit breaker opens and no fallback is configured, THE AI_Corp_Platform SHALL fail the workflow step with an error

### Requirement 30: Agent Message History and Meeting Room

**User Story:** As a Board member, I want to see the conversation history between agents, so that I can understand their collaboration.

#### Acceptance Criteria

1. WHEN an agent sends a message to another agent or all agents, THE AI_Corp_Platform SHALL store the message in the database
2. WHEN storing a message, THE AI_Corp_Platform SHALL record sender role, recipient role, message type, and timestamp
3. WHEN a Board member views the meeting room, THE AI_Corp_Platform SHALL display messages sorted by timestamp
4. WHEN displaying messages, THE AI_Corp_Platform SHALL distinguish between chat, thinking, action, and notification message types
5. WHEN an agent broadcasts to all agents, THE AI_Corp_Platform SHALL set recipient role to null
6. THE AI_Corp_Platform SHALL index messages by project ID and timestamp for efficient querying
