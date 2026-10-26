# Use Case Specifications — AI-CORP Multi-Agent Platform

| **Field** | **Value** |
|-----------|-----------|
| **Document Version** | 1.0.0 |
| **Date** | December 10, 2024 |
| **Authors** | AI-CORP Development Team |
| **Status** | Draft - Under Review |
| **Project** | Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation |

---

## 1. System Overview

The AI-CORP Multi-Agent Platform is an enterprise-grade workflow automation system that leverages multiple AI agents to coordinate complex project management tasks. The system implements a sophisticated multi-agent architecture where specialized AI agents (CEO, PM, DEV, QA, QC, Marketing, BA, Architect) collaborate to transform high-level project goals into deliverable outputs through automated workflows.

The platform is built on NestJS with TypeScript, using PostgreSQL for data persistence, Redis/BullMQ for asynchronous workflow orchestration, and Socket.IO for real-time communication. The system integrates with LLM providers through a gateway routing service (9Router/OpenCode) and executes untrusted code in isolated Docker sandboxes for security.

Human users (Board Members and Administrators) initiate projects, monitor progress, approve critical workflow steps, and manage system configuration. The platform provides cost tracking, semantic memory search using vector embeddings (pgvector), and real-time agent activity visualization through a Virtual Office interface.

---

## 2. Actor Definitions

| **Actor** | **Type** | **Description** | **Responsibilities** |
|-----------|----------|-----------------|----------------------|
| **Board Member** | Human | Primary user who owns and manages projects | Create projects, approve/reject workflow steps, monitor progress, review cost dashboards, set budget alerts |
| **Admin** | Human | System administrator with elevated privileges | Manage user accounts, configure agent LLM models, monitor system health, review API usage logs, manage RBAC |
| **CEO Agent** | AI Agent | Strategic planning agent | Define high-level milestones, formulate project vision, coordinate other agents, ensure alignment with business goals |
| **PM Agent** | AI Agent | Project management agent | Break down milestones into tasks, prioritize backlog, estimate task complexity, manage sprint planning |
| **DEV Agent** | AI Agent | Software development agent | Implement code, write unit tests, document code, execute development tasks in sandbox environment |
| **QA Agent** | AI Agent | Quality assurance agent (process) | Own the OOAD quality gate, review code against the approved design (use cases, domain model, patterns, layering), approve or reject implementation |
| **QC Agent** | AI Agent | Quality control agent (product, NEW) | Derive acceptance tests from use cases, maintain the traceability matrix, report use case coverage |
| **Marketing Agent** | AI Agent | Marketing and communication agent | Draft product announcements, create release notes, communicate with stakeholders |
| **BA Agent** | AI Agent | Business analyst agent (NEW) | Analyze requirements, create use case specifications, define acceptance criteria, document functional requirements |
| **Architect Agent** | AI Agent | Software architect agent (NEW) | Design system architecture, select technologies, create architecture decision records (ADR), generate component diagrams |
| **System** | Internal | Automated system processes | Route LLM requests, manage agent memory, orchestrate workflows, enforce resource limits, handle errors |

---

## 3. Use Case Catalog

### 3.1 Project Management Use Cases

### UC-001: User Authentication

| Field | Value |
|-------|-------|
| **ID** | UC-001 |
| **Name** | User Authentication |
| **Actors** | Board Member, Admin |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
A user authenticates with the system using email and password credentials to gain access to the platform.

**Pre-conditions:**
1. User has a registered account in the system.
2. PostgreSQL database is connected and accessible.

**Post-conditions:**
1. User receives a JWT access token valid for the session.
2. User role (board_member or admin) is identified and permissions are granted.
3. User can access role-specific features and API endpoints.

**Main Flow:**
1. User navigates to the login page.
2. System displays login form with email and password fields.
3. User enters email address.
4. User enters password.
5. User clicks "Login" button.
6. System validates email format.
7. System queries User table for matching email.
8. System compares provided password with stored passwordHash using bcrypt.
9. System generates JWT token with payload {sub: userId, email, role}.
10. System returns access token and user profile to client.
11. Client stores token in secure storage (HTTP-only cookie or localStorage).
12. System redirects user to dashboard.

**Alternative Flows:**
- **AF-1: Invalid Credentials**
  - At step 8, if email not found or password mismatch occurs:
    1. System returns HTTP 401 Unauthorized with message "Invalid credentials."
    2. User corrects credentials and retries from step 3.

- **AF-2: Database Unavailable**
  - At step 7, if PostgreSQL connection fails:
    1. System throws ServiceUnavailableException with message "Database is not connected."
    2. System logs error for admin investigation.
    3. User waits and retries later.

**Exception Flows:**
- **EF-1: Malformed Request**
  - If email or password fields are missing:
    1. System returns HTTP 400 Bad Request with validation errors.
    2. User corrects input and resubmits.

**Special Requirements:**
- **SR-1:** Password must be hashed using bcrypt with salt rounds ≥ 12.
- **SR-2:** JWT tokens must expire after 24 hours.
- **SR-3:** Failed login attempts must be rate-limited (5 attempts per 15 minutes per IP).
- **SR-4:** Passwords must meet complexity requirements (min 8 characters, 1 uppercase, 1 number).

**Assumptions:**
- User has access to a modern web browser supporting ES2020.
- Network connectivity is stable.

---

### UC-002: Create Project

| Field | Value |
|-------|-------|
| **ID** | UC-002 |
| **Name** | Create Project |
| **Actors** | Board Member |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
A Board Member creates a new project by providing project details (name, description, goal, budget), which triggers an automated workflow starting with the CEO Agent's strategic planning phase.

**Pre-conditions:**
1. User is authenticated with board_member or admin role.
2. User has not exceeded project creation quota (maximum 10 active projects per user).
3. Workflow Engine (BullMQ + Redis) is operational.

**Post-conditions:**
1. Project record is created in database with status = "active".
2. WorkflowRun is created with default agent workflow (CEO → PM → DEV → QA → Marketing).
3. CEO Agent begins milestone planning within 5 seconds (async job dispatched).
4. Board Member is redirected to project detail page.
5. WebSocket notification is sent to user confirming project creation.

**Main Flow:**
1. Board Member navigates to "New Project" page.
2. System displays project creation form.
3. Board Member enters project name (3-200 characters).
4. Board Member enters project description (max 2000 characters).
5. Board Member enters project goal (what the product should achieve).
6. Board Member optionally enters budget (decimal ≥ 0).
7. Board Member clicks "Create Project" button.
8. System validates all inputs (sanitization against prompt injection, length checks).
9. System checks uniqueness of project name for this user.
10. System creates Project record with costAccrued = 0.
11. System creates default WorkflowDefinition (nodes: CEO → PM → DEV → QA → Marketing).
12. System creates WorkflowRun with status = "running", projectId, workflowDefId.
13. System dispatches async BullMQ job for CEO agent execution.
14. System returns HTTP 201 Created with project ID.
15. System sends WebSocket event {type: "project:created", projectId}.
16. Client redirects to /projects/{projectId}.

**Alternative Flows:**
- **AF-1: Validation Failure**
  - At step 8, if validation fails (e.g., name too short, invalid budget):
    1. System returns HTTP 400 Bad Request with field-specific error messages.
    2. Board Member corrects input and resubmits from step 3.

- **AF-2: Duplicate Project Name**
  - At step 9, if project name already exists for this user:
    1. System returns HTTP 409 Conflict with message "Project name must be unique."
    2. Board Member changes project name and resubmits.

- **AF-3: Workflow Engine Unavailable**
  - At step 12, if Redis/BullMQ is unreachable:
    1. System creates project but sets WorkflowRun.status = "pending".
    2. System logs error for admin review.
    3. System displays warning: "Project created but workflow delayed."
    4. System automatically retries workflow dispatch when engine recovers.

**Exception Flows:**
- **EF-1: Database Timeout**
  - If PostgreSQL transaction takes > 5 seconds:
    1. System rolls back transaction.
    2. System returns HTTP 500 Internal Server Error.
    3. User retries from step 1.

**Special Requirements:**
- **SR-1:** Project creation response time must be < 2 seconds (excluding async workflow dispatch).
- **SR-2:** All text inputs must be sanitized against prompt injection using sanitizeUserInput().
- **SR-3:** Budget, if provided, must be positive (validated by Prisma schema constraint).
- **SR-4:** System must support concurrent project creation by multiple users without race conditions.

**Assumptions:**
- Board Member has sufficient understanding of project goals to articulate them clearly.
- CEO Agent has sufficient LLM quota to begin strategic planning.

---

### UC-003: Configure Agent

| Field | Value |
|-------|-------|
| **ID** | UC-003 |
| **Name** | Configure Agent Model Settings |
| **Actors** | Admin |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
An Admin modifies the LLM model configuration for a specific agent role, including provider, model name, and fallback settings.

**Pre-conditions:**
1. User is authenticated with admin role.
2. Agent record exists in database with valid role (CEO, PM, DEV, QA, QC, MARKETING, BA, ARCHITECT).

**Post-conditions:**
1. Agent.modelRouteConfig is updated with new {provider, model, fallbackProvider} JSON.
2. Agent will use new model configuration on next LLM call (callLLM() reads latest config from DB).
3. Change is logged in audit trail.

**Main Flow:**
1. Admin navigates to Agent Configuration page.
2. System displays list of all agents with current model settings.
3. Admin selects an agent (e.g., CEO Agent).
4. System displays agent detail form with editable fields:
   - Provider (dropdown: "opencode", "anthropic", "openai")
   - Model (text input: e.g., "openrouter/openrouter/free", "claude-3-5-sonnet-20241022")
   - Fallback Provider (optional dropdown)
5. Admin modifies provider to "anthropic".
6. Admin modifies model to "claude-3-5-sonnet-20241022".
7. Admin clicks "Save Changes".
8. System validates model configuration (provider must be supported, model string not empty).
9. System updates Agent.modelRouteConfig JSON in database.
10. System returns HTTP 200 OK with updated agent record.
11. System displays success notification: "CEO Agent model updated to claude-3-5-sonnet-20241022."

**Alternative Flows:**
- **AF-1: Validation Failure**
  - At step 8, if provider is unsupported:
    1. System returns HTTP 400 Bad Request: "Provider 'xyz' is not supported."
    2. Admin corrects and retries from step 5.

- **AF-2: Read-Only Mode**
  - If system is in read-only maintenance mode:
    1. System disables form editing and displays notice.
    2. Admin must wait until maintenance completes.

**Exception Flows:**
- **EF-1: Database Write Failure**
  - If update fails due to connection issue:
    1. System returns HTTP 500 with error message.
    2. System logs error.
    3. Admin retries or escalates to infrastructure team.

**Special Requirements:**
- **SR-1:** Model configuration changes take effect immediately without requiring agent restart.
- **SR-2:** System must preserve backward compatibility if new providers are added.
- **SR-3:** Admin must receive warning if selecting expensive models (e.g., GPT-4).

**Assumptions:**
- Admin understands LLM provider capabilities and pricing models.
- LLM gateway (9Router) supports configured provider/model combinations.

---

### UC-004: Execute Project Workflow

| Field | Value |
|-------|-------|
| **ID** | UC-004 |
| **Name** | Execute Project Workflow |
| **Actors** | Workflow Engine (System), AI Agents |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
The Workflow Engine orchestrates a multi-agent workflow defined as a DAG, executing agent tasks, handling parallel branches, managing human approvals, and transitioning through workflow states until completion or failure.

**Pre-conditions:**
1. WorkflowRun exists with status = "running".
2. WorkflowDefinition is valid (no cycles, startNode and endNode defined).
3. Redis/BullMQ queue is operational.
4. All referenced agents exist in Agent table.

**Post-conditions:**
1. If successful: WorkflowRun.status = "completed", completedAt timestamp set.
2. If failed: WorkflowRun.status = "failed", error logged in WorkflowStep.
3. All WorkflowSteps have status = "completed" or "failed" or "skipped".
4. Project milestones/tasks are created or updated based on workflow output.
5. Board Member is notified via WebSocket of workflow completion.

**Main Flow:**
1. Workflow Engine retrieves WorkflowRun from database.
2. Engine validates WorkflowDefinition (checks for cycles using topological sort).
3. Engine sets currentNodeId = startNode.
4. Engine enters execution loop:
5. Engine retrieves current WorkflowNode by currentNodeId.
6. Engine checks node type:
   - If "agent_task": Proceed to step 7.
   - If "human_approval": Proceed to UC-005 (Approve Workflow Step).
   - If "condition": Evaluate condition expression, select edge, transition to next node.
   - If "parallel": Spawn parallel BullMQ jobs for each branch (go to step 14).
7. (agent_task) Engine creates WorkflowStep record with status = "running".
8. Engine invokes AgentOrchestrator.executeAgentTask(agentRole, taskContext).
9. Agent executes think() phase (loads memories, calls LLM for reasoning).
10. Agent emits WebSocket event {type: "agent:thinking", agentRole, message}.
11. Agent executes act() phase (executes tools in sandbox, performs actions).
12. Agent saves memory of task completion.
13. Engine updates WorkflowStep: status = "completed", output = agent result.
14. Engine merges agent output into WorkflowRun.context.
15. Engine selects next node via outgoing edges (default edge or conditional).
16. Engine updates WorkflowRun.currentNodeId = nextNodeId.
17. Engine repeats from step 5 until currentNodeId = endNode.
18. Engine sets WorkflowRun.status = "completed", completedAt = now().
19. Engine sends WebSocket event {type: "workflow:completed", workflowRunId}.

**Alternative Flows:**
- **AF-1: Agent Execution Failure**
  - At step 11, if agent throws error (e.g., LLM timeout):
    1. Engine increments WorkflowStep.retryCount.
    2. If retryCount < 3:
       - Engine waits 2^retryCount seconds (exponential backoff).
       - Engine retries from step 9.
    3. If retryCount ≥ 3:
       - Engine sets WorkflowStep.status = "failed", error = error message.
       - Engine sets WorkflowRun.status = "failed".
       - Engine notifies Board Member of failure.
       - Workflow terminates.

- **AF-2: Human Approval Required**
  - At step 6, if node type = "human_approval":
    1. Engine creates Approval record with status = "pending".
    2. Engine sets WorkflowRun.status = "paused".
    3. Engine sends WebSocket notification to Board Member.
    4. Engine waits (flow continues in UC-005).

- **AF-3: Parallel Branch Execution**
  - At step 6, if node type = "parallel":
    1. Engine identifies all parallel child nodes.
    2. Engine spawns separate BullMQ jobs for each branch.
    3. Engine waits for all jobs to complete (uses BullMQ's job dependencies).
    4. Engine merges all branch outputs into context.
    5. Engine transitions to merge node and continues.

- **AF-4: Loop Detection**
  - At step 16, if same node visited > 3 times:
    1. Engine detects infinite loop.
    2. Engine sets WorkflowRun.status = "failed", error = "Loop detected".
    3. Workflow terminates.

**Exception Flows:**
- **EF-1: Database Connection Lost During Execution**
  - If Prisma loses connection mid-workflow:
    1. Engine catches error, logs to file.
    2. Engine exits without updating status.
    3. On next system restart, UC-015 (Recover Workflow) restores state and continues.

- **EF-2: Redis Queue Full**
  - If BullMQ cannot enqueue job:
    1. Engine waits 10 seconds and retries.
    2. After 3 retries, marks workflow as "failed".

**Special Requirements:**
- **SR-1:** Workflow execution must be idempotent (restarting from last checkpoint should not duplicate actions).
- **SR-2:** Maximum workflow execution time: 24 hours (configurable timeout).
- **SR-3:** All state transitions must be atomic (use database transactions).
- **SR-4:** System must support at least 100 concurrent workflows.

**Assumptions:**
- DAG is validated before workflow starts (no cycles).
- Agents do not enter infinite reasoning loops.

---

### UC-005: Approve Workflow Step

| Field | Value |
|-------|-------|
| **ID** | UC-005 |
| **Name** | Approve Workflow Step |
| **Actors** | Board Member |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
Board Member reviews an approval request from a paused workflow and provides approval, allowing the workflow to continue to the next node.

**Pre-conditions:**
1. WorkflowRun is paused at a human_approval node.
2. Approval record exists with status = "pending".
3. Board Member is authenticated and has access to the project.

**Post-conditions:**
1. Approval.status = "approved".
2. Approval.respondedAt timestamp is set.
3. WorkflowRun.status transitions from "paused" to "running".
4. Workflow continues to next node based on "onApprove" edge.
5. WebSocket notification sent to project participants.

**Main Flow:**
1. Workflow Engine creates Approval request (called from UC-004).
2. System sends WebSocket event {type: "human_approval_required", approvalId, workflowRunId, approvalType, requestData} to Board Member.
3. Board Member receives real-time notification in UI.
4. Board Member navigates to Approvals page.
5. System displays list of pending approvals with details.
6. Board Member selects approval request.
7. System displays approval details:
   - Approval type (e.g., "milestone_approval", "deployment_approval")
   - Request data (context from agent, e.g., milestone descriptions)
   - Current workflow state
8. Board Member reviews request data.
9. Board Member optionally enters comment in text field.
10. Board Member clicks "Approve" button.
11. System validates approval status is "pending" (enforces state machine transition rule 17.7).
12. System updates Approval: status = "approved", comment = user comment, respondedAt = now().
13. System calls WorkflowEngine.resumeWorkflow(workflowRunId, skipAutoProcess=true).
14. Engine updates WorkflowRun.status = "running".
15. Engine calls transitionToNextNode(workflowRunId, edgeCondition="onApprove").
16. Engine selects edge with condition "onApprove" from current node.
17. Engine updates WorkflowRun.currentNodeId = target node.
18. Engine calls processCurrentNode() to execute next agent task.
19. System returns HTTP 200 OK with updated approval.
20. System sends WebSocket event {type: "approval:responded", approvalId, status: "approved"}.

**Alternative Flows:**
- **AF-1: Board Member Rejects**
  - At step 10, Board Member clicks "Reject":
    1. System updates Approval.status = "rejected".
    2. Engine selects edge with condition "onReject".
    3. Workflow follows rejection path (e.g., rollback, notify agents).
    4. Use Case continues as UC-006 (Reject Workflow Step).

- **AF-2: Invalid State Transition**
  - At step 11, if Approval.status is not "pending":
    1. System throws error "Cannot transition approval from status '{currentStatus}'".
    2. System returns HTTP 400 Bad Request.
    3. Board Member refreshes page to see current state.

**Exception Flows:**
- **EF-1: Workflow Already Cancelled**
  - If WorkflowRun.status = "cancelled" before approval:
    1. System displays warning: "Workflow has been cancelled."
    2. Approval response has no effect.

**Special Requirements:**
- **SR-1:** Approval response must be processed within 2 seconds.
- **SR-2:** Approval requests must expire after 72 hours (configurable).
- **SR-3:** System must support approval delegation (Board Member can assign to another user).

**Assumptions:**
- Board Member has domain knowledge to evaluate agent outputs.
- Approval data is presented in human-readable format.

---

### UC-006: Reject Workflow Step

| Field | Value |
|-------|-------|
| **ID** | UC-006 |
| **Name** | Reject Workflow Step |
| **Actors** | Board Member |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
Board Member rejects an approval request, causing the workflow to follow the rejection path (e.g., return to previous agent for revision, terminate workflow, or trigger rollback).

**Pre-conditions:**
1. Same as UC-005 pre-conditions.

**Post-conditions:**
1. Approval.status = "rejected".
2. Approval.comment contains rejection reason.
3. WorkflowRun follows "onReject" edge (may terminate or return to earlier node).
4. Agents are notified of rejection via WebSocket.

**Main Flow:**
1. Steps 1-9 identical to UC-005.
10. Board Member clicks "Reject" button.
11. System prompts for mandatory rejection comment.
12. Board Member enters comment explaining rejection reason.
13. Board Member confirms rejection.
14. System validates approval status is "pending".
15. System updates Approval: status = "rejected", comment, respondedAt = now().
16. System calls WorkflowEngine.resumeWorkflow(workflowRunId).
17. Engine calls transitionToNextNode(workflowRunId, edgeCondition="onReject").
18. Engine follows "onReject" edge (target may be earlier node for rework or endNode for termination).
19. If target is endNode: Engine sets WorkflowRun.status = "cancelled".
20. If target is rework node: Engine dispatches agent task with rejection feedback.
21. System sends WebSocket event {type: "approval:responded", status: "rejected", comment}.

**Alternative Flows:**
- **AF-1: No Rejection Path Defined**
  - At step 18, if "onReject" edge does not exist:
    1. Engine defaults to terminating workflow.
    2. WorkflowRun.status = "cancelled".

**Exception Flows:**
- None beyond UC-005.

**Special Requirements:**
- **SR-1:** Rejection comment is mandatory (min 10 characters).
- **SR-2:** Rejected approvals must be logged for audit purposes.

**Assumptions:**
- WorkflowDefinition includes appropriate rejection handling paths.

---

### UC-007: Monitor Workflow Progress

| Field | Value |
|-------|-------|
| **ID** | UC-007 |
| **Name** | Monitor Workflow Progress |
| **Actors** | Board Member |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
Board Member views real-time progress of an active workflow, including current node, completed steps, agent activities, and timeline.

**Pre-conditions:**
1. Board Member is authenticated.
2. Project has at least one WorkflowRun.

**Post-conditions:**
1. Board Member gains visibility into workflow state.
2. No state changes (read-only operation).

**Main Flow:**
1. Board Member navigates to Project Detail page.
2. System displays project overview with Workflow tab.
3. Board Member clicks Workflow tab.
4. System queries WorkflowRun and WorkflowSteps for project.
5. System renders workflow visualization:
   - DAG diagram showing all nodes and edges.
   - Current node highlighted in yellow.
   - Completed nodes in green.
   - Failed nodes in red.
   - Pending nodes in gray.
6. System displays execution timeline (list of completed steps with timestamps).
7. System displays current agent activity (from WebSocket events).
8. Board Member observes workflow progressing in real-time.
9. System pushes WebSocket updates when node status changes.
10. UI automatically updates visualization without page refresh.

**Alternative Flows:**
- **AF-1: No Active Workflow**
  - At step 4, if no WorkflowRuns exist:
    1. System displays message: "No workflows executed yet."

- **AF-2: Workflow Paused**
  - If WorkflowRun.status = "paused":
    1. System displays "Paused" badge with reason (e.g., "Waiting for approval").
    2. System shows pending approval details with link to UC-005.

**Exception Flows:**
- None (read-only operation).

**Special Requirements:**
- **SR-1:** Workflow visualization must update within 1 second of state change.
- **SR-2:** System must support zooming/panning for large DAGs (>50 nodes).

**Assumptions:**
- WebSocket connection is stable.

---

### UC-008: View Cost Dashboard

| Field | Value |
|-------|-------|
| **ID** | UC-008 |
| **Name** | View Cost Dashboard |
| **Actors** | Board Member |
| **Priority** | Medium |
| **Status** | Documented |

> Phase 5: also available to the Viewer role (`report:view`), and as a JSON report in UC-022.

**Brief Description:**  
Board Member views cost analytics for a project, including token usage breakdown by agent, cost trends over time, and comparison against budget.

**Pre-conditions:**
1. Board Member is authenticated.
2. Project has at least one ApiUsageLog record.

**Post-conditions:**
1. Board Member understands project cost consumption.
2. No state changes (read-only operation).

**Main Flow:**
1. Board Member navigates to Project Detail page.
2. Board Member clicks "Cost Analytics" tab.
3. System queries ApiUsageLog filtered by projectId.
4. System aggregates data:
   - Total cost (sum of actualCost).
   - Cost by agent role (group by agentRole, sum actualCost).
   - Cost by LLM model (group by actualModelUsed, sum actualCost).
   - Cost over time (group by date, sum actualCost).
5. System calculates budget utilization: (costAccrued / budget) * 100%.
6. System renders dashboard:
   - Hero metric: Total cost with budget percentage.
   - Pie chart: Cost by agent role.
   - Bar chart: Cost by LLM model.
   - Line chart: Cost trend over time (last 30 days).
   - Table: Top 10 most expensive LLM calls with details.
7. Board Member reviews cost data.

**Alternative Flows:**
- **AF-1: No Budget Set**
  - At step 5, if project.budget is null:
    1. System displays total cost without percentage.
    2. System shows message: "No budget configured for this project."

- **AF-2: Budget Exceeded**
  - If costAccrued > budget:
    1. System displays red alert: "Budget exceeded by {amount}".
    2. System highlights alert threshold.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Dashboard must load within 3 seconds for projects with <10,000 API calls.
- **SR-2:** Cost values must be displayed in USD with 4 decimal precision.

**Assumptions:**
- ApiUsageLog has accurate cost data from LLM provider.

---

### 3.2 New Agent Use Cases

### UC-009: Analyze Requirements (BA Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-009 |
| **Name** | Analyze Requirements |
| **Actors** | BA Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
BA Agent receives project goals and stakeholder inputs, then uses LLM reasoning to extract functional and non-functional requirements, generate use case templates, and document acceptance criteria.

**Pre-conditions:**
1. Project exists with goal defined.
2. CEO Agent has completed strategic planning (milestones created).
3. BA Agent is configured and active.

**Post-conditions:**
1. Requirements document (Markdown) is generated and stored.
2. Functional requirements (FR-001, FR-002, ...) are enumerated.
3. Non-functional requirements (NFR-001, NFR-002, ...) are documented.
4. Use case templates are created (can be refined by human).
5. AgentMemory is updated with requirements analysis insights.

**Main Flow:**
1. Workflow Engine invokes BA Agent with context: {projectGoal, milestones, stakeholderInputs}.
2. BA Agent enters think() phase:
3. BA loads semantic memories from namespace "requirements_patterns" (previous similar projects).
4. BA constructs prompt: "You are a Business Analyst. Analyze this project goal: {goal}. Extract functional and non-functional requirements. Generate use case outlines."
5. BA calls LLM (callLLM()) with prompt and project context.
6. LLM returns structured analysis (JSON format with FR/NFR lists, use case outlines).
7. BA Agent enters act() phase:
8. BA parses LLM response and extracts requirements.
9. BA generates Markdown document with sections:
   - Functional Requirements (prioritized list with IDs).
   - Non-Functional Requirements (categories: performance, security, usability).
   - Use Case Outlines (brief description, actors, main flow sketch).
   - Acceptance Criteria (for each FR).
10. BA stores document in project folder (e.g., docs/requirements/requirements-analysis.md).
11. BA saves memory: "Analyzed requirements for project '{projectName}': identified {count} FRs and {count} NFRs."
12. BA emits WebSocket event {type: "agent:action", action: "requirements_documented"}.
13. BA returns AgentResult with output: {documentPath, requirementsCount, useCaseCount}.
14. Workflow Engine merges output into context.

**Alternative Flows:**
- **AF-1: Ambiguous Requirements**
  - At step 6, if LLM indicates ambiguity:
    1. BA creates clarification questions list.
    2. BA creates human_approval node requesting stakeholder input.
    3. Workflow pauses until Board Member provides clarifications.
    4. BA retries analysis with additional context.

- **AF-2: LLM Call Fails**
  - At step 5, if LLM times out or returns error:
    1. BA retries with exponential backoff (3 retries).
    2. If all retries fail, BA returns partial analysis with error flag.
    3. Workflow marks step as "failed", notifies Board Member.

**Exception Flows:**
- **EF-1: Insufficient Context**
  - If projectGoal is too vague (<20 characters):
    1. BA throws error: "Project goal too vague for analysis."
    2. Workflow pauses, requests human to refine goal.

**Special Requirements:**
- **SR-1:** BA must use structured output parsing (JSON mode) for requirements extraction.
- **SR-2:** Generated document must follow IEEE 830 format where applicable.
- **SR-3:** BA should identify conflicting requirements and flag for human review.

**Assumptions:**
- Project goal is written in natural language (English or Vietnamese).
- LLM has sufficient reasoning capability for requirements engineering.

---

### UC-010: Design System Architecture (Architect Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-010 |
| **Name** | Design System Architecture |
| **Actors** | Architect Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
Architect Agent reads requirements from BA Agent, evaluates technology options, generates system architecture diagrams (PlantUML), and documents architecture decisions in ADR format.

**Pre-conditions:**
1. BA Agent has completed requirements analysis (UC-009).
2. Requirements document exists.
3. Architect Agent is configured and active.

**Post-conditions:**
1. Architecture Decision Record (ADR) is created.
2. System component diagram (PlantUML) is generated.
3. Technology stack is recommended with justification.
4. Architecture patterns are identified (e.g., microservices, event-driven, layered).
5. AgentMemory is updated with architecture knowledge.

**Main Flow:**
1. Workflow Engine invokes Architect Agent with context: {requirements, constraints (budget, timeline, team skills)}.
2. Architect enters think() phase:
3. Architect loads memories from namespace "architecture_patterns" and "technology_decisions".
4. Architect constructs prompt: "You are a Software Architect. Design system architecture for these requirements: {FR list, NFR list}. Recommend technology stack. Generate component diagram (PlantUML syntax)."
5. Architect calls LLM with extended context (including past successful architectures).
6. LLM returns architecture proposal: {recommendedStack, components[], integrations[], diagram (PlantUML code), rationale}.
7. Architect enters act() phase:
8. Architect validates PlantUML syntax (attempts to render with plantuml library or validates syntax).
9. Architect generates ADR document (docs/architecture/ADR-001-{decision-name}.md) with template:
   - Status: Proposed
   - Context: Requirements summary
   - Decision: Technology stack and architecture patterns chosen
   - Consequences: Trade-offs, risks, benefits
10. Architect saves PlantUML diagram to docs/diagrams/architecture/component-diagram.puml.
11. Architect saves memory: "Designed architecture for {projectName}: chose {stack} with {pattern} pattern."
12. Architect emits event {type: "agent:action", action: "architecture_designed"}.
13. Architect returns AgentResult: {adrPath, diagramPath, stack}.

**Alternative Flows:**
- **AF-1: Multiple Viable Options**
  - At step 6, if LLM proposes 3+ architecture alternatives:
    1. Architect generates comparison matrix (pros/cons for each option).
    2. Architect creates human_approval request for Board Member to choose.
    3. Workflow pauses until decision is made.

- **AF-2: PlantUML Syntax Error**
  - At step 8, if PlantUML validation fails:
    1. Architect retries LLM call with error feedback.
    2. If retry fails, Architect generates simplified diagram or pseudocode.

**Exception Flows:**
- **EF-1: Conflicting NFRs**
  - If requirements contain impossible trade-offs (e.g., ultra-high performance + minimal cost):
    1. Architect flags conflict in ADR.
    2. Architect requests human prioritization.

**Special Requirements:**
- **SR-1:** Architecture must satisfy all high-priority NFRs.
- **SR-2:** Diagram must use UML 2.5 component diagram notation.
- **SR-3:** Technology recommendations must consider team expertise (from context).

**Assumptions:**
- Architect has access to up-to-date technology trend data (via LLM training or RAG).
- PlantUML rendering is available for validation.

---

### UC-011: Plan Development Sprint (PM Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-011 |
| **Name** | Plan Development Sprint |
| **Actors** | PM Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
PM Agent breaks down milestones into granular tasks, prioritizes them, estimates complexity, and assigns to sprints.

**Pre-conditions:**
1. Milestones exist in database (created by CEO Agent).
2. PM Agent is active.

**Post-conditions:**
1. Tasks are created with status = "todo", priority (high/medium/low), estimatedCost.
2. Tasks are associated with milestones.
3. Task backlog is populated and ready for DEV Agent.

**Main Flow:**
1. Workflow Engine invokes PM Agent with context: {milestones[]}.
2. PM enters think() phase:
3. PM loads memories from "task_estimation" namespace (historical task data).
4. PM constructs prompt: "Break down these milestones into actionable tasks: {milestone descriptions}. For each task, provide: title, description, priority, estimated effort (hours)."
5. PM calls LLM.
6. LLM returns task breakdown (JSON array of {title, description, priority, estimatedHours}).
7. PM enters act() phase:
8. PM iterates over each task from LLM response.
9. PM calculates estimatedCost (if historical data available, use ML model; else use heuristic).
10. PM creates Task record in database:
    - projectId, milestoneId, title, description, status="todo", priority, estimatedCost.
11. PM emits event for each task created.
12. PM saves memory: "Created {count} tasks for milestone '{milestoneName}'."
13. PM returns AgentResult: {tasksCreated: count, taskIds[]}.

**Alternative Flows:**
- **AF-1: Milestone Too Vague**
  - At step 5, if LLM cannot break down milestone:
    1. PM requests human clarification via approval node.
    2. Workflow pauses.

**Exception Flows:**
- None beyond standard LLM failures.

**Special Requirements:**
- **SR-1:** Each task must be completable in <8 hours (guideline for granularity).
- **SR-2:** Priority must follow MoSCoW method (Must, Should, Could, Won't → mapped to high/medium/low).

**Assumptions:**
- Milestones are well-defined.

---

### UC-012: Execute Development Task (DEV Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-012 |
| **Name** | Execute Development Task |
| **Actors** | DEV Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
DEV Agent implements code for a task, writes unit tests, and executes tests in a sandboxed Docker environment.

**Pre-conditions:**
1. Task exists with status = "todo".
2. Architecture and requirements are documented.
3. DEV Agent is active.

**Post-conditions:**
1. Code files are generated.
2. Unit tests are written and executed.
3. Task.status = "review" (if tests pass) or "todo" (if tests fail).
4. Code is stored in project repository or returned as artifact.

**Main Flow:**
1. Workflow Engine invokes DEV Agent with context: {task, architecture, requirements}.
2. DEV enters think() phase:
3. DEV loads memories from "coding_conventions" namespace.
4. DEV constructs prompt: "Implement this task: {taskDescription}. Follow these conventions: {conventions}. Technology stack: {stack}. Write code and unit tests."
5. DEV calls LLM.
6. LLM returns code files (e.g., {fileName: "UserService.ts", content: "..."}, {fileName: "UserService.spec.ts", content: "..."}).
7. DEV enters act() phase:
8. DEV writes files to temporary directory.
9. DEV invokes executeTool("run_tests", command: "npm test UserService.spec.ts", sandbox: true).
10. Sandbox executes tests in isolated Docker container (node:18-alpine).
11. Sandbox returns ToolResult: {success: true/false, output: test results, executionTimeMs}.
12. DEV parses test output:
    - If all tests pass: DEV updates Task.status = "review".
    - If tests fail: DEV analyzes failures, retries code generation (up to 2 retries), or flags for human review.
13. DEV saves memory: "Implemented {taskTitle}: {passedTests} tests passed."
14. DEV emits event {type: "agent:action", action: "code_implemented", taskId}.
15. DEV returns AgentResult: {codeFiles[], testResults}.

**Alternative Flows:**
- **AF-1: Tests Fail After Retries**
  - At step 12, if tests still fail after 2 retries:
    1. DEV creates comment on Task: "Tests failed: {error summary}".
    2. DEV sets Task.status = "todo" with flag needsHumanReview.
    3. Workflow pauses for human intervention.

- **AF-2: Sandbox Timeout**
  - At step 10, if sandbox execution exceeds timeout (30 seconds):
    1. Sandbox kills container.
    2. DEV treats as test failure, retries with optimized code.

**Exception Flows:**
- **EF-1: Malicious Code Detected**
  - If code contains suspicious patterns (e.g., network calls, file system access outside allowed paths):
    1. Sandbox rejects execution.
    2. DEV logs security violation.
    3. Task is flagged for manual review.

**Special Requirements:**
- **SR-1:** All code must pass linting (ESLint/Prettier).
- **SR-2:** Unit test coverage must be ≥ 80% for new code.
- **SR-3:** Sandbox must enforce resource limits (256MB RAM, 50% CPU, 30s timeout).

**Assumptions:**
- Task descriptions are sufficiently detailed for code generation.
- LLM can generate syntactically correct code (or DEV retries until correct).

---

### UC-013: Execute Code Review (QA Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-013 |
| **Name** | Execute Code Review |
| **Actors** | QA Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
QA Agent reviews code submitted by DEV Agent, performs static analysis, checks for security vulnerabilities, and approves or rejects the code.

**Pre-conditions:**
1. Task.status = "review".
2. Code files are available.
3. QA Agent is active.

**Post-conditions:**
1. If approved: Task.status = "done", code is merged.
2. If rejected: Task.status = "todo", feedback is provided to DEV Agent.
3. Code review report is generated.

**Main Flow:**
1. Workflow Engine invokes QA Agent with context: {task, codeFiles[]}.
2. QA enters think() phase:
3. QA loads memories from "code_quality_standards" namespace.
4. QA constructs prompt: "Review this code for: correctness, security vulnerabilities (SQL injection, XSS, etc.), performance issues, adherence to coding standards. Code: {codeContent}."
5. QA calls LLM.
6. LLM returns review report: {issues: [{severity: "high/medium/low", description, line}], recommendation: "approve/reject"}.
7. QA enters act() phase:
8. QA performs static analysis using tool (e.g., ESLint, SonarQube API call in sandbox).
9. QA merges LLM findings + static analysis results.
10. QA calculates quality score (0-100 based on issue severity and count).
11. If qualityScore ≥ 80 and no high-severity issues:
    - QA updates Task.status = "done".
    - QA approves code.
12. Else:
    - QA updates Task.status = "todo".
    - QA creates comment with detailed feedback.
    - QA notifies DEV Agent to revise.
13. QA saves memory: "Reviewed code for {taskTitle}: {issueCount} issues found, {recommendation}."
14. QA returns AgentResult: {qualityScore, issues[], recommendation}.

**Alternative Flows:**
- **AF-1: Critical Security Vulnerability**
  - At step 11, if high-severity security issue detected:
    1. QA immediately rejects code.
    2. QA escalates to Board Member with alert.
    3. Task is blocked until fixed.

- **AF-2: Marginal Quality (Score 70-79)**
  - If score is borderline:
    1. QA creates human_approval request for Board Member to decide.
    2. Workflow pauses.

**Exception Flows:**
- None beyond standard LLM failures.

**Special Requirements:**
- **SR-1:** Code review must complete within 60 seconds for files <1000 lines.
- **SR-2:** QA must check against OWASP Top 10 vulnerabilities.
- **SR-3:** Review report must be human-readable and actionable.

**Assumptions:**
- Static analysis tools are integrated and accessible.

---

### UC-014: Create Marketing Strategy (Marketing Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-014 |
| **Name** | Create Marketing Strategy |
| **Actors** | Marketing Agent |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
Marketing Agent generates product announcements, release notes, and communication plans when milestones are completed.

**Pre-conditions:**
1. Milestone.status = "completed".
2. Marketing Agent is active.

**Post-conditions:**
1. Marketing document (announcement, release notes) is generated.
2. Document is stored for Board Member review.
3. AgentMemory is updated with brand voice examples.

**Main Flow:**
1. Workflow Engine invokes Marketing Agent with context: {milestone, completedTasks[]}.
2. Marketing enters think() phase:
3. Marketing loads memories from "brand_voice" namespace.
4. Marketing constructs prompt: "Write a product announcement for this milestone: {milestoneName, description, key features delivered}. Tone: {brandVoice}."
5. Marketing calls LLM.
6. LLM returns announcement text (Markdown format).
7. Marketing enters act() phase:
8. Marketing saves document to docs/marketing/announcement-{milestoneId}.md.
9. Marketing optionally generates social media posts (Twitter, LinkedIn variants).
10. Marketing saves memory: "Created announcement for milestone '{milestoneName}'."
11. Marketing returns AgentResult: {announcementPath, socialPosts[]}.

**Alternative Flows:**
- None.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Announcement must be concise (<500 words).
- **SR-2:** Tone must match brand voice (loaded from memory).

**Assumptions:**
- Milestone has clear deliverables.

---

### UC-015: Coordinate Multi-Agent Workflow (CEO Agent)

| Field | Value |
|-------|-------|
| **ID** | UC-015 |
| **Name** | Coordinate Multi-Agent Workflow |
| **Actors** | CEO Agent |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
CEO Agent orchestrates high-level workflow by delegating tasks to appropriate agents (BA → Architect → PM → DEV → QA → Marketing) and monitoring overall progress.

**Pre-conditions:**
1. Project is created.
2. All agents are active.

**Post-conditions:**
1. Workflow is successfully coordinated through all phases.
2. Milestones are completed.
3. CEO provides strategic oversight and adjustments.

**Main Flow:**
1. Workflow Engine starts with CEO Agent as entry point.
2. CEO enters think() phase:
3. CEO analyzes project goal and determines workflow sequence.
4. CEO constructs delegation plan: BA (requirements) → Architect (design) → PM (tasks) → DEV (code) → QA (review) → Marketing (announce).
5. CEO calls LLM to validate plan and identify risks.
6. CEO enters act() phase:
7. CEO triggers WorkflowDefinition with nodes for each agent.
8. CEO monitors progress via WorkflowRun status.
9. If any agent fails:
    - CEO analyzes failure reason.
    - CEO decides: retry, skip, or escalate to human.
10. CEO saves memory: "Coordinated workflow for project '{projectName}': {status}."
11. CEO returns AgentResult: {workflowCompleted: true, summary}.

**Alternative Flows:**
- **AF-1: Budget Exceeded Mid-Workflow**
  - If costAccrued > budget during execution:
    1. CEO pauses workflow.
    2. CEO notifies Board Member.
    3. CEO waits for budget increase or project cancellation.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** CEO must ensure no agent is overloaded (fair task distribution).
- **SR-2:** CEO must provide summary reports at each phase completion.

**Assumptions:**
- CEO has authority to override agent decisions if needed.

---

### UC-016: Verify Implementation against Use Cases (QC Agent)

> Revised 2026-10-26: replaces "Deploy Application (DevOps Agent)". DevOps was removed from the agent roster and QC was added (see Implementation_plan.md, Status & Audit).
> Revised 2026-10-26 (Phase 3, Task 12): QC now executes the tests in the sandbox, so coverage counts *passing* use cases.

| Field | Value |
|-------|-------|
| **ID** | UC-016 |
| **Name** | Verify Implementation against Use Cases |
| **Actors** | QC Agent |
| **Priority** | High |
| **Status** | Implemented |

**Brief Description:**  
QC Agent derives acceptance tests from every use case written by the BA, writes them into the generated project, runs the project's Jest suite in the sandbox, and builds the traceability matrix (use case → domain classes → implementation files → tests → Passing / Failing / Missing) with the use case coverage.

**Pre-conditions:**
1. The OOAD quality gate passed (use cases, domain model and patterns exist in ooadMetadata).
2. DEV Agent has written the implementation to the project workspace.
3. QC Agent is active.

**Post-conditions:**
1. One acceptance test file per untested use case exists under tests/ (describe('UC-xxx: ...')).
2. docs/traceability-matrix.md is written to the project workspace.
3. ooadMetadata.testCoverage and ooadMetadata.traceability are updated.
4. Workflow variables qc_passed, testCoverage, missingUseCases, failingUseCases, failingTests, testsExecuted and qcReport are available to QA.
5. The project workspace is unchanged by the test run (read-only mount).

**Main Flow:**
1. Workflow Engine invokes QC Agent (node "test", after "develop").
2. QC enters think(): loads memories from the "test_design" namespace.
3. QC loads use cases from ooadMetadata (fallback: parses docs/use-cases.md) and entity names from the domain model.
4. QC reads all source and test files of the project workspace.
5. QC builds a first traceability pass to find use cases without tests.
6. QC prompts the LLM with those use cases and the application services, asking for one Jest test file per use case (main, alternative and exception flows).
7. QC writes the returned test files under tests/, rejecting unsafe or non-test paths.
8. QC runs `jest --json` on a copy of projects/<id>/ through SandboxExecutor.runInWorkspace (read-only mount, tmpfs work dir, no network) and maps each test to its use case by the UC-xxx id in its title or file name.
9. QC rebuilds the traceability matrix over the final file set and the executed results (Passing / Failing / Missing) and writes docs/traceability-matrix.md.
10. QC persists testCoverage (passing use cases / all use cases) and the pass/fail counts to ooadMetadata.traceability.
11. QC returns qc_passed = coverage ≥ 80% and no failing High-priority use case, plus failingTests for QA.

**Alternative Flows:**
- **AF-1: All Use Cases Already Covered**
  - At step 5, if no use case is missing tests, QC skips steps 6–7.
- **AF-2: Tests Cannot Be Executed**
  - At step 8, if there is no Docker daemon (and the local fallback is not enabled with SANDBOX_ALLOW_LOCAL_RUN), the project has no package.json / jest.config.js, or the run times out, QC keeps the static coverage (use cases with tests count as Covered) and notes the reason in the matrix.

**Exception Flows:**
- **EF-1: Coverage Below 80%**
  - At step 11, QC emits a quality_warning WebSocket event listing the missing use cases; QA takes the report into account.
- **EF-3: High-Priority Use Case Failing**
  - At step 11, qc_passed is false even with coverage ≥ 80%; QC emits a quality_warning with the failing use cases and QA receives the failing tests (and rejects, sending the run back to DEV).
- **EF-2: No Project Context**
  - QC returns a failed action result; the workflow node fails and is retried.

**Special Requirements:**
- **SR-1:** Test names must carry the use case id so the matrix can trace them.
- **SR-2:** Files are written only inside projects/<projectId>/ of the project workspace.
- **SR-3:** Generated code runs only in the sandbox container (read-only mount, no capabilities, no network unless a package registry is configured); the host fallback is opt-in.

**Assumptions:**
- Executing the generated tests in the sandbox is Phase 3 Task 12.

---

### 3.3 System Management Use Cases

### UC-017: Manage Agent Memory

| Field | Value |
|-------|-------|
| **ID** | UC-017 |
| **Name** | Manage Agent Memory |
| **Actors** | System (MemoryService) |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
System automatically manages agent memories by storing observations with vector embeddings, performing semantic search, and pruning old low-importance memories.

**Pre-conditions:**
1. Agent completes a task or learns new information.
2. PostgreSQL with pgvector extension is enabled.

**Post-conditions:**
1. Memory is stored in AgentMemory table with embedding.
2. Memory is searchable via semantic similarity.
3. Low-importance memories are pruned if storage limit exceeded.

**Main Flow:**
1. Agent calls saveMemory(namespace, content, importance, projectId).
2. MemoryService receives memory save request.
3. MemoryService validates importance ∈ [1, 10] (Requirement 17.3).
4. MemoryService generates embedding:
   - Calls LLM provider with "embed" API.
   - Receives vector embedding (e.g., 1536-dimensional array for OpenAI).
   - Serializes embedding as JSON string.
5. MemoryService creates AgentMemory record: {agentId, agentRole, namespace, content, embedding, importance, metadata}.
6. MemoryService commits to database.
7. MemoryService checks if agent memory count > threshold (e.g., 1000 memories per agent).
8. If threshold exceeded:
   - MemoryService deletes oldest memories with importance < 5.
9. MemoryService returns memoryId.

**Alternative Flows:**
- **AF-1: Embedding Generation Fails**
  - At step 4, if LLM embedding API fails:
    1. MemoryService stores memory with embedding = null.
    2. Memory is still text-searchable but not semantically searchable.
    3. Background job retries embedding generation later.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Embedding generation must complete within 5 seconds.
- **SR-2:** Semantic search must return results within 500ms for databases <100k memories.
- **SR-3:** Memory pruning must not delete high-importance memories (importance ≥ 8).

**Assumptions:**
- pgvector extension is installed and HNSW index is created.

---

### UC-018: Route LLM Request

| Field | Value |
|-------|-------|
| **ID** | UC-018 |
| **Name** | Route LLM Request |
| **Actors** | System (LLMProviderFactory, 9Router Gateway) |
| **Priority** | High |
| **Status** | Documented |

**Brief Description:**  
System routes LLM requests to appropriate provider (9Router, OpenAI, Anthropic) based on agent configuration, handles circuit breaker fallback, and logs usage for cost tracking.

**Pre-conditions:**
1. Agent calls callLLM(params).
2. LLM gateway is configured.

**Post-conditions:**
1. LLM response is returned to agent.
2. Token usage is logged in ApiUsageLog.
3. Circuit breaker state is updated if failure occurs.

**Main Flow:**
1. Agent calls callLLM({messages, maxTokens}).
2. BaseAgent retrieves latest model config from database: {provider, model, fallbackProvider}.
3. BaseAgent calls LLMProviderFactory.getProvider(modelConfig).
4. Factory returns provider instance (e.g., NineRouterProvider).
5. BaseAgent calls provider.chat({messages, model, maxTokens}).
6. Provider sends HTTP request to LLM gateway (e.g., POST https://9router.dev/v1/chat/completions).
7. Gateway returns response: {content, tokenUsage: {promptTokens, completionTokens}, actualModelUsed}.
8. Provider parses response and returns ChatResult.
9. BaseAgent logs API usage to ApiUsageLog:
   - {projectId, agentRole, requestedModel, actualModelUsed, actualProvider, tokenUsage, estimatedCost, responseTimeMs}.
10. BaseAgent returns ChatResult to agent.

**Alternative Flows:**
- **AF-1: Circuit Breaker Triggered**
  - At step 6, if provider has 3+ consecutive failures (circuit breaker open):
    1. Provider skips request to primary and immediately uses fallback.
    2. Provider calls fallbackProvider (e.g., Anthropic).
    3. ChatResult includes isFallbackTriggered = true.
    4. System logs fallback usage.

- **AF-2: Primary Provider Timeout**
  - At step 6, if request times out (>30 seconds):
    1. Provider increments failure counter.
    2. Provider retries with fallback provider.
    3. If fallback also fails, throws error to agent.

**Exception Flows:**
- **EF-1: All Providers Fail**
  - If both primary and fallback providers fail:
    1. System throws LLMUnavailableException.
    2. Agent handles error (may retry or pause workflow).
    3. System notifies Board Member of LLM outage.

**Special Requirements:**
- **SR-1:** Circuit breaker must open after 3 consecutive failures within 5 minutes.
- **SR-2:** Circuit breaker must reset (half-open) after 60 seconds.
- **SR-3:** Response time must be logged with millisecond precision.

**Assumptions:**
- LLM providers have >99.5% uptime SLA.

---

### UC-019: Handle Workflow Rollback

| Field | Value |
|-------|-------|
| **ID** | UC-019 |
| **Name** | Handle Workflow Rollback |
| **Actors** | System (Workflow Engine) |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
System restores workflow to a previous checkpoint when a critical failure occurs or Board Member requests rollback.

**Pre-conditions:**
1. WorkflowRun has at least one completed step.
2. Workflow supports rollback (nodes have rollback handlers defined).

**Post-conditions:**
1. WorkflowRun.currentNodeId is set to target checkpoint node.
2. All steps after checkpoint are marked as "skipped".
3. Context is restored to checkpoint state.
4. Board Member is notified of rollback.

**Main Flow:**
1. Board Member clicks "Rollback to Step X" button (or system detects critical failure).
2. System identifies target checkpoint node.
3. System validates rollback is possible (checkpoint must be before currentNodeId in DAG).
4. System creates WorkflowSnapshot (memento pattern) of current state before rollback.
5. System updates WorkflowRun:
   - currentNodeId = checkpoint node.
   - context = checkpoint context (restored from WorkflowStep.output).
6. System marks all steps after checkpoint as status = "skipped".
7. System invokes rollback handlers for affected nodes (e.g., delete created tasks, undo file changes).
8. System sends WebSocket event {type: "workflow:rolled_back", targetNode}.
9. System resumes workflow from checkpoint node.

**Alternative Flows:**
- **AF-1: Rollback Handler Fails**
  - At step 7, if rollback handler throws error:
    1. System logs error but continues rollback.
    2. System flags partial rollback status.
    3. Board Member must manually clean up.

**Exception Flows:**
- **EF-1: No Valid Checkpoint**
  - If target node is not a valid checkpoint:
    1. System rejects rollback request.
    2. System suggests nearest valid checkpoint.

**Special Requirements:**
- **SR-1:** Rollback must complete within 10 seconds.
- **SR-2:** Critical data (database records) must be preserved or archived, not deleted.

**Assumptions:**
- Workflow nodes have idempotent rollback handlers.

---

### UC-020: Manage Task Kanban

| Field | Value |
|-------|-------|
| **ID** | UC-020 |
| **Name** | Manage Task Kanban |
| **Actors** | Board Member |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
Board Member views and manually updates task statuses in a Kanban board interface (columns: TODO, IN_PROGRESS, REVIEW, DONE).

**Pre-conditions:**
1. Project has tasks.

**Post-conditions:**
1. Task statuses are updated according to Kanban rules (Requirement 17: valid transitions).

**Main Flow:**
1. Board Member navigates to Kanban board page.
2. System queries tasks for project, groups by status.
3. System renders 4 columns: TODO, IN_PROGRESS, REVIEW, DONE.
4. Board Member drags task card from TODO to IN_PROGRESS.
5. System validates transition (TODO → IN_PROGRESS is allowed).
6. System updates Task.status = "in_progress".
7. System emits WebSocket event for real-time sync.

**Alternative Flows:**
- **AF-1: Invalid Transition**
  - At step 5, if Board Member tries invalid transition (e.g., DONE → TODO):
    1. System rejects drag operation with animation.
    2. System displays toast: "Invalid status transition."

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Kanban board must support drag-and-drop on desktop and touch on mobile.
- **SR-2:** Status transitions must follow Kanban rules (enforced in backend).

**Assumptions:**
- Board Member understands Kanban methodology.

---

### UC-021: View Agent Meeting Room

| Field | Value |
|-------|-------|
| **ID** | UC-021 |
| **Name** | View Agent Meeting Room |
| **Actors** | Board Member |
| **Priority** | Low |
| **Status** | Documented |

**Brief Description:**  
Board Member observes real-time agent-to-agent communication in a virtual office interface.

**Pre-conditions:**
1. Project has active workflow.
2. Agents are emitting messages (via WebSocket).

**Post-conditions:**
1. Board Member gains insight into agent reasoning and collaboration.

**Main Flow:**
1. Board Member navigates to Virtual Office page.
2. System displays chat interface with agent avatars.
3. Agents emit messages during workflow execution (e.g., "CEO: Delegating requirements analysis to BA Agent").
4. System pushes messages via WebSocket to frontend.
5. Frontend appends messages to chat window in real-time.
6. Board Member reads agent conversations.

**Alternative Flows:**
- None.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Messages must appear within 500ms of agent emitting them.
- **SR-2:** Chat history must be scrollable (last 100 messages).

**Assumptions:**
- WebSocket connection is stable.

---

### UC-022: Generate Project Report

> Implemented 2026-10-26 (Phase 5, Task 23).

| Field | Value |
|-------|-------|
| **ID** | UC-022 |
| **Name** | Generate Project Report |
| **Actors** | Board Member, Viewer (read only), External System (via UC-032), System (weekly scheduler) |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
A Board Member views the cost and agent performance report of a project and exports the project as a PDF report, a CSV of tasks or the full data as JSON. Every week the system also writes a Markdown summary into each active project's workspace.

**Pre-conditions:**
1. The user is authenticated and has `report:view` (reading) or `project:export` and owns the project (exporting; admin can export any project).

**Post-conditions:**
1. Reading changes nothing. An export is recorded in the audit log (`project.export`).

**Main Flow:**
1. Board Member opens Project Detail and selects *Reports*.
2. System returns the cost report (`GET /api/reports/projects/:id/cost`: total, budget used, cost and tokens by agent and by model, by day) and the performance report (`GET /api/reports/performance?projectId=`: runs, success rate, average and p95 duration and retries per role or node, from workflow steps).
3. Board Member clicks *PDF report*, *Tasks (CSV)* or *Full data (JSON)*.
4. System checks ownership, builds a `ProjectExportSnapshot` and hands it to the exporter for the format (Strategy, `PROJECT_EXPORTERS`).
5. System returns the file as an attachment (`GET /api/projects/:id/export?format=pdf|csv|json`).

**Alternative Flows:**
- **AF-1: Weekly report** — `WeeklyReportScheduler` runs every `REPORT_SCHEDULER_INTERVAL_MINUTES` (0 disables it), writes `reports/weekly-<ISO week>.md` once per week for each active project and raises `ReportGeneratedEvent` (audit + `report.generated` webhook). An admin can run it now with `POST /api/reports/weekly/run`. The file is listed in the *Artifacts* tab (UC-026).
- **AF-2: No step finished yet** — success rate is shown as "–", not 0%.

**Exception Flows:**
- **EF-1:** Unknown format → 400. **EF-2:** Not the owner → 403 (and `access.denied` in the audit log). **EF-3:** Unknown project → 404.

**Special Requirements:**
- **SR-1:** The PDF renders Vietnamese text when a Unicode font is found (`PDF_FONT_PATH` or common system fonts); otherwise diacritics are folded into Helvetica.
- **SR-2:** CSV starts with a UTF-8 BOM (opens correctly in Excel) and cells starting with `= + - @` are escaped (CSV injection).
- **SR-3:** Email delivery of the weekly report is out of scope (no mail server in the platform); it is delivered through the workspace and the webhook.

---

### UC-023: Perform Code Quality Analysis (DEV and QA Agents)

> Rewritten 2026-10-26 (Phase 6, Task 26) to match the implementation. The first version ran ESLint, SonarQube and Istanbul in the sandbox and asked the QA agent for a debt estimate in hours; the platform instead analyses the generated TypeScript itself, lets the DEV agent fix what it finds once, and gives QA the result as evidence.

| Field | Value |
|-------|-------|
| **ID** | UC-023 |
| **Name** | Perform Code Quality Analysis |
| **Actors** | DEV Agent, QA Agent, Board Member (reads the result) |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
After the DEV agent writes code, the system measures every generated source file (syntax, cyclomatic complexity, maintainability index, unsafe calls, hard-coded secrets, OOAD layer violations, use case references), scores it and predicts the QA verdict. Code predicted to fail is refined once by the DEV agent; the QA review receives the analysis as evidence.

**Pre-conditions:**
1. The DEV agent has written files under `src/` in the project workspace (UC-012).

**Post-conditions:**
1. `docs/code-quality.md` is in the project workspace and the DEV output carries `codeQuality` (score, verdict, findings summary, refinement).
2. The refined files replace the originals only if the score went up.

**Main Flow:**
1. DEV agent writes its files.
2. System analyses each source file (tests excluded) with `TypeScriptCodeAnalyzer` (TypeScript compiler API): syntax errors, per-function McCabe complexity, Halstead volume and maintainability index, security rules, imports that break the layer rules.
3. `CodeQualityPolicy` scores each file (100 minus capped penalties), weights the files by LOC and predicts the QA verdict: *fail* if the score is below the threshold (70, `CODE_QUALITY_MIN_SCORE`) or there is a syntax error or layer violation.
4. If the verdict is *fail*, the DEV agent gets the findings and rewrites the weakest files once (AF-1).
5. System writes `docs/code-quality.md` and adds `codeQuality` to the DEV output.
6. QA agent's review prompt includes the static analysis; QA gives its verdict (UC-013).
7. Board Member opens *Reports → Code quality* (`GET /api/projects/:id/code-quality`).

**Alternative Flows:**
- **AF-1: Refinement does not help** — at step 4, if the rewritten files score no better, the original files are kept and the report says so; QA then decides (the e2e run's *Unsafe Portal*: QA rejects, the DEV agent runs again).
- **AF-2: Refinement disabled** — `CODE_QUALITY_REFINE=off` skips step 4.

**Exception Flows:**
- **EF-1:** The analysis throws → it is logged and the DEV output is returned without `codeQuality` (never fails the DEV step).

**Special Requirements:**
- **SR-1:** At most one refinement round (bounded LLM cost).
- **SR-2:** Analysis is deterministic; results are cached per file content and per project for 30 s (Task 28).
- **SR-3:** The prediction is measured against the real QA verdicts (UC-033, *QA prediction accuracy*).

---

### UC-024: Forecast Project Effort and Cost (System, PM Agent)

> Rewritten 2026-10-26 (Phase 6, Task 25). The first version trained a model per task from ≥ 50 completed tasks and estimated hours; the platform records no human hours, so it forecasts the agents' run time and LLM cost per project from finished projects and derives the PM's task estimates from it.

| Field | Value |
|-------|-------|
| **ID** | UC-024 |
| **Name** | Forecast Project Effort and Cost |
| **Actors** | System, PM Agent, Board Member (reads the forecast) |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
From the finished projects, the system learns per agent role how run time and LLM cost grow with the size of the request (description length, number of use cases). It forecasts a new project when its workflow starts and again when the plan is known, sets the PM's task estimates, and compares each forecast with the outcome.

**Pre-conditions:**
1. A project's workflow starts (`workflow.started`).

**Post-conditions:**
1. A `ProjectEstimate` (stage `start` or `planned`) is stored with time, cost, confidence and per-role detail.
2. Tasks created by the PM carry `estimatedCost`.

**Main Flow:**
1. System collects one training sample per finished project and role (projects whose latest run completed).
2. `EstimationModel` fits, per role, a ridge linear regression on the features, or the median when the role has fewer than 6 samples, and measures it by leave-one-out error.
3. On `workflow.started`, System forecasts the project and stores the `start` estimate.
4. When the PM agent creates tasks, System stores the `planned` estimate and sets each task's `estimatedCost` (DEV + QC + QA cost divided by the number of tasks).
5. Board Member opens *Reports → Effort & cost forecast* (`GET /api/projects/:id/estimate`) or *Agent Analytics → Estimation model* (`GET /api/analytics/estimation`).
6. When the project is finished, System shows the error of the `start` forecast against the outcome.

**Alternative Flows:**
- **AF-1: No history** — no finished project: no forecast is stored and tasks keep `estimatedCost = null`.
- **AF-2: Little history** — fewer than 6 samples for a role: the median is used and the confidence is *low*.

**Special Requirements:**
- **SR-1:** The model is cached and retrained only when a run completes (cache key: number of completed runs and last completion time).
- **SR-2:** Predictions never go below the smallest value seen (no negative cost from extrapolation).

---

### UC-025: Monitor System Health (Admin)

| Field | Value |
|-------|-------|
| **ID** | UC-025 |
| **Name** | Monitor System Health |
| **Actors** | Admin |
| **Priority** | Medium |
| **Status** | Documented |

**Brief Description:**  
Admin monitors system health metrics including database connection, Redis queue status, LLM gateway status, and Docker sandbox availability.

**Pre-conditions:**
1. Admin is authenticated.

**Post-conditions:**
1. Admin understands system health status.
2. Incidents are identified early.

**Main Flow:**
1. Admin navigates to Health Dashboard.
2. System queries /health/db, /health/redis, /health/llm, /health/sandbox endpoints.
3. System displays status indicators:
   - Database: Green (connected) / Red (disconnected).
   - Redis: Green / Yellow (high queue length) / Red.
   - LLM Gateway: Green (circuit closed) / Yellow (half-open) / Red (open).
   - Sandbox: Green (Docker running) / Red.
4. System displays recent errors from logs.
5. Admin reviews metrics.

**Alternative Flows:**
- **AF-1: Critical Service Down**
  - If any service is red:
    1. System sends alert notification (email/Slack).
    2. Admin investigates and resolves issue.

**Exception Flows:**
- None.

**Special Requirements:**
- **SR-1:** Health checks must run every 30 seconds.
- **SR-2:** Admin must be alerted within 60 seconds of critical failure.

**Assumptions:**
- Health check endpoints are reliable.

---

### UC-026: Browse Generated Project Artifacts

> Added 2026-10-26 (Phase 3, Task 13).

| Field | Value |
|-------|-------|
| **ID** | UC-026 |
| **Name** | Browse Generated Project Artifacts |
| **Actors** | Board Member |
| **Priority** | High |
| **Status** | Implemented |

**Brief Description:**  
Board Member opens the *Artifacts* tab of a project to see what the agents produced: use cases, diagrams, architecture notes, generated code, acceptance tests and the traceability matrix, plus the OOAD quality gate checklist, QC warnings and the OOAD summary. The whole project can be downloaded as a zip.

**Pre-conditions:**
1. Board Member is authenticated.
2. The project exists; at least the BA has written files to the project workspace.

**Post-conditions:**
1. Nothing is changed: the workspace is read only through ProjectWorkspace.

**Main Flow:**
1. Board Member opens Project Detail and selects *Artifacts*.
2. System loads the file list (`GET /api/projects/:id/files`), the gate history (`GET /api/projects/:id/quality-gates`) and the OOAD summary (`GET /api/ooad-metrics/project/:id`).
3. System shows the OOAD summary (use cases, entities, patterns, gate pass rate, use case test coverage with passing / failing / missing use cases), the latest result of each quality gate with its checklist, and the file tree.
4. System opens `docs/use-cases.md` by default.
5. Board Member selects a file; System loads it (`GET /api/projects/:id/files/<path>`) and renders Markdown as formatted text, `*.puml` as a diagram (PlantUML server) with a source toggle, and code/JSON with line numbers.
6. Board Member clicks *Download zip*; System returns `GET /api/projects/:id/archive` with every file under `<project-slug>/`.

**Alternative Flows:**
- **AF-1: Live quality events**
  - While a workflow runs, `quality_gate_result` and `quality_warning` events update the gate checklist and the warning list and refresh the file list.
- **AF-2: Diagram rendering off**
  - If `VITE_PLANTUML_SERVER` is empty, or the server cannot render the diagram, System shows the PlantUML source.

**Exception Flows:**
- **EF-1: Path outside the project** — a path with `..`, an absolute path or an encoded traversal returns 400.
- **EF-2: Unknown project or file** — 404; a project without files returns 404 for the archive.
- **EF-3: File larger than 1 MB** — 413; the UI suggests the archive.
- **EF-4: Not authenticated** — 401.

**Special Requirements:**
- **SR-1:** Generated text is rendered as React elements, never injected as HTML.
- **SR-2:** Diagram sources are sent to the configured PlantUML server; use a self-hosted server for private projects.

---

### UC-029: Manage Users and Roles

> Added 2026-10-26 (Phase 5, Task 20).

| Field | Value |
|-------|-------|
| **ID** | UC-029 |
| **Name** | Manage Users and Roles |
| **Actors** | Admin |
| **Priority** | High |
| **Status** | Implemented |

**Brief Description:**  
Admin sees every user with their role and permissions, changes a user's role (admin, board member, viewer) and deactivates or reactivates an account.

**Pre-conditions:**
1. Admin is authenticated (`user:manage`).

**Post-conditions:**
1. The new role or access state applies from the user's next request. The change is in the audit log with before/after (`user.role_change`, `user.access_change`).

**Main Flow:**
1. Admin opens *Users & Roles*; System lists users (`GET /api/users`) and the permission matrix (`GET /api/users/roles`).
2. Admin picks a new role; System saves it (`PATCH /api/users/:id/role`).
3. Admin switches *Access* off; System deactivates the account (`PATCH /api/users/:id/active`). The user's token and API keys stop working at once.

**Exception Flows:**
- **EF-1:** Admin changes their own role or access → 400.
- **EF-2:** The change would leave no active admin → 400.
- **EF-3:** A non-admin calls the endpoints → 403 (`access.denied`).

**Special Requirements:**
- **SR-1:** Permissions are defined once (`RolePolicy`) and shared with the web app, which hides what the user cannot do; the API enforces them on every request.
- **SR-2:** Changing a project, its tasks, runs or approvals also requires owning the project (admin is exempt).

---

### UC-030: Review Audit Log

> Added 2026-10-26 (Phase 5, Task 21).

| Field | Value |
|-------|-------|
| **ID** | UC-030 |
| **Name** | Review Audit Log |
| **Actors** | Admin |
| **Priority** | High |
| **Status** | Implemented |

**Brief Description:**  
Admin searches the record of user, agent and system actions, sees what each change did (before/after per field), exports the result to CSV and is warned about security anomalies.

**Pre-conditions:**
1. Admin is authenticated (`audit:view`).

**Post-conditions:**
1. Nothing is changed (the log is append-only; there is no update or delete endpoint).

**Main Flow:**
1. Admin opens *Audit Log*; System returns the latest entries (`GET /api/audit`) and anomalies (`GET /api/audit/anomalies`).
2. Admin filters by text, action, result and date range.
3. Admin expands an entry; System shows the actor, resource, IP, user agent and the field-level changes.
4. Admin clicks *Export CSV* (`GET /api/audit/export`) with the same filters.

**Alternative Flows:**
- **AF-1: Anomaly** — five or more failed logins for one account or IP within 15 minutes, or ten or more denied requests by one actor within 10 minutes, are shown as warnings at the top.

**Special Requirements:**
- **SR-1:** Passwords, tokens, secrets and API keys are redacted before an entry is stored.
- **SR-2:** Failing to write an audit entry never fails the user's action (it is logged instead).

---

### UC-031: Manage API Keys and Webhooks

> Added 2026-10-26 (Phase 5, Task 22).

| Field | Value |
|-------|-------|
| **ID** | UC-031 |
| **Name** | Manage API Keys and Webhooks |
| **Actors** | Board Member, Admin |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
A user creates API keys for external tools (with scopes and an optional expiry) and registers webhooks that receive signed notifications about project events.

**Pre-conditions:**
1. The user is authenticated (`integration:manage`).

**Post-conditions:**
1. The key's secret is shown once and only its hash is stored. Webhook deliveries are recorded.

**Main Flow:**
1. User opens *Integrations*.
2. User creates an API key: name, scopes (only permissions the user has), expiry. System shows `aic_<id>_<secret>` once (`POST /api/integrations/api-keys`).
3. User registers a webhook: URL, events, optional project. System returns the signing secret (`POST /api/integrations/webhooks`).
4. User clicks *Test*; System sends a signed `webhook.test` (`POST /api/integrations/webhooks/:id/test`) and shows the response code.
5. User opens *Deliveries* to see each delivery's status, attempts and response code.
6. User revokes a key or deletes a webhook.

**Exception Flows:**
- **EF-1:** Webhook URL is not http(s), has credentials, or points to a private, loopback or link-local address → 400 (re-checked after DNS at send time).
- **EF-2:** Scope not held by the user → 400.

**Special Requirements:**
- **SR-1:** Signature header `X-AICorp-Signature: sha256=HMAC(secret, "<timestamp>.<body>")`; receivers should reject timestamps older than 5 minutes.
- **SR-2:** Failed deliveries are retried with exponential backoff; the workflow never waits for receivers.

---

### UC-032: Call the Integration API

> Added 2026-10-26 (Phase 5, Task 22).

| Field | Value |
|-------|-------|
| **ID** | UC-032 |
| **Name** | Call the Integration API |
| **Actors** | External System |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
An external tool (CI pipeline, BI tool) uses an API key to list and create projects, read a project's status and cost report, export it and manage its webhooks through the versioned `/api/v1` API, documented with OpenAPI at `/api/docs`.

**Pre-conditions:**
1. A usable API key exists (UC-031) and its owner is active.

**Main Flow:**
1. External System sends a request with header `x-api-key`.
2. System authenticates the key, applies the per-key rate limit and checks the key's scopes (see SD-009).
3. System runs the request as the key's owner, limited to the key's scopes, and audits it with actor type `api_key`.

**Exception Flows:**
- **EF-1:** Missing, unknown, revoked or expired key → 401.
- **EF-2:** More than `API_RATE_LIMIT_PER_MINUTE` requests in a minute → 429 with `Retry-After`.
- **EF-3:** Scope missing or project not owned → 403.
- **EF-4:** An API key used on a route outside `/api/v1` → 401.

---

### UC-033: Review Agent Performance Analytics

> Added 2026-10-26 (Phase 6, Task 24).

| Field | Value |
|-------|-------|
| **ID** | UC-033 |
| **Name** | Review Agent Performance Analytics |
| **Actors** | Board Member, Admin, System (anomaly monitor), External System (webhook) |
| **Priority** | Medium |
| **Status** | Implemented |

**Brief Description:**  
Board Member compares the agents over a period: success rate, duration, cost per successful step, a role-specific quality measure, the trend against the previous period and a ranking. The system warns about anomalies and notifies integrations.

**Pre-conditions:**
1. The user has `report:view`.

**Post-conditions:**
1. Nothing is changed by viewing. A detected anomaly is published once per role, type and day (`agent.anomaly`), audited and sent to subscribed webhooks.

**Main Flow:**
1. User opens *Agent Analytics* and picks 7, 30 or 90 days (`GET /api/analytics/agents?days=`).
2. `AgentPerformanceAnalyzer` computes per role: steps, success rate, average and p95 duration, cost per success, quality, trend and rank; a daily success series, an activity heatmap and the accuracy of the QA prediction (UC-023).
3. Quality is role-specific: QA approvals for DEV, QC test results for QC, OOAD gate results for the Architect, first-attempt success for the others.
4. `AgentAnomalyDetector` applies its rules (success-rate drop, repeated failures, cost spike, slowdown, low quality) and the page shows the anomalies first.
5. The page shows the estimation model and its accuracy (UC-024).

**Alternative Flows:**
- **AF-1: Anomaly while nobody watches** — after each finished or failed run, `AgentAnomalyMonitor` evaluates the last 7 days and publishes new anomalies (`agent.anomaly`), which the audit log and webhooks receive (UC-030, UC-031).

**Special Requirements:**
- **SR-1:** Under 300 ms p50 for 20 concurrent users (`scripts/perf/budgets.json`).

---

## 4. Use Case Relationships

### Include Relationships
- **UC-012** (Execute Development Task) includes **UC-028** (Execute Tool in Sandbox).
- **UC-016** (Deploy Application) includes **UC-028** (Execute Tool in Sandbox).
- **UC-004** (Execute Project Workflow) includes **UC-005** (Approve Workflow Step), **UC-013** (Execute Agent Task), **UC-014** (Execute Parallel Branch).

### Extend Relationships
- **UC-006** (Reject Workflow Step) extends **UC-005** (Approve Workflow Step).
- **UC-023** (Perform Code Quality Analysis) extends **UC-012** (Execute Development Task) and gives evidence to **UC-013** (Execute Code Review).
- **UC-033** (Review Agent Performance Analytics) includes the accuracy views of **UC-023** and **UC-024**.

### Generalization Relationships
- **UC-005** (Approve Workflow Step) and **UC-006** (Reject Workflow Step) generalize to "Handle Human Approval".
- **UC-009-016** (All Agent Use Cases) generalize to "Execute Agent Task" abstract use case.

---

## 5. Traceability to Requirements

| Use Case ID | Functional Requirement IDs | Non-Functional Requirement IDs |
|-------------|---------------------------|--------------------------------|
| UC-001 | FR-AUTH-001 (User Authentication) | NFR-SEC-001 (Password Hashing), NFR-PERF-001 (Response Time <2s) |
| UC-002 | FR-PROJ-001 (Project Creation), FR-WF-001 (Workflow Initialization) | NFR-PERF-001, NFR-SEC-002 (Prompt Injection Prevention) |
| UC-009 | FR-AGENT-001 (BA Agent Requirements Analysis) | NFR-QUALITY-001 (IEEE 830 Format) |
| UC-010 | FR-AGENT-002 (Architect Agent System Design) | NFR-QUALITY-002 (UML 2.5 Compliance) |
| UC-016 | FR-AGENT-003 (QC Agent Use Case Verification) | NFR2 (Test Coverage) |
| UC-017 | FR-MEMORY-001 (Agent Memory Management) | NFR-PERF-002 (Semantic Search <500ms) |
| UC-018 | FR-LLM-001 (LLM Request Routing) | NFR-RELIABILITY-001 (Circuit Breaker) |
| UC-023 | FR-CQ-001 (Static analysis of generated code), FR-CQ-002 (One refinement round), FR-CQ-003 (QA evidence & prediction) | NFR-QUALITY-003 (Quality score), NFR-PERF-006 (Load budgets) |
| UC-024 | FR-EST-001 (Effort & cost model), FR-EST-002 (Forecast at start and plan), FR-EST-003 (Task estimates), FR-EST-004 (Forecast accuracy) | NFR-ACCURACY-001 (Measured LOO error) |
| UC-026 | FR-PROJ-008 (Generated Project Artifacts) | NFR-SEC (path confinement) |
| UC-022 | FR-REP-001 (Cost & performance reports), FR-REP-002 (Project export), FR-REP-003 (Weekly report) | NFR-SEC-010 (CSV injection) |
| UC-029 | FR-AUTH-003 (RBAC), FR-AUTH-005 (Account deactivation) | NFR-SEC-007 (Least privilege) |
| UC-030 | FR-AUD-001 (Audit trail), FR-AUD-002 (Audit search & export), FR-AUD-003 (Anomaly detection) | NFR-SEC-008 (Secret redaction) |
| UC-031 | FR-INT-001 (API keys), FR-INT-002 (Webhooks) | NFR-SEC-009 (SSRF & signatures) |
| UC-032 | FR-INT-003 (Versioned integration API) | NFR-SEC-009, NFR-SEC-007 |
| UC-033 | FR-ANA-001 (Agent metrics & ranking), FR-ANA-002 (Anomaly detection & notification) | NFR-PERF-006 (Load budgets) |

---

## 6. Assumptions and Constraints

### Assumptions
1. LLM providers (9Router, OpenAI, Anthropic) have >99% uptime.
2. Board Members have sufficient domain knowledge to evaluate agent outputs.
3. Docker is available for sandbox execution.
4. PostgreSQL with pgvector extension is properly configured.
5. Network latency to LLM providers is <200ms.

### Constraints
1. System must support up to 100 concurrent workflows.
2. Maximum workflow execution time: 24 hours.
3. Sandbox execution timeout: 30 seconds per tool invocation.
4. Database must handle 10,000 memory records per agent.
5. Budget for LLM API calls: configurable per project.

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **Agent** | An AI entity with a specific role (CEO, PM, DEV, etc.) that performs autonomous tasks using LLM reasoning. |
| **Workflow** | A Directed Acyclic Graph (DAG) of nodes representing tasks executed by agents or requiring human approval. |
| **Sandbox** | An isolated Docker container (node:18-alpine) for secure code execution with resource limits. |
| **Circuit Breaker** | A fault tolerance pattern that prevents repeated calls to failing LLM providers. |
| **Memory** | A stored observation (text + vector embedding) that agents use for context-aware reasoning. |
| **Kanban** | An agile methodology for task management with columns representing workflow stages. |
| **ADR** | Architecture Decision Record documenting key technology and design choices. |

---

**End of Use Case Specifications Document**

*Version 1.0.0 | December 10, 2024 | AI-CORP Development Team*
