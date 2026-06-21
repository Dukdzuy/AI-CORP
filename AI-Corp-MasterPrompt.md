# MASTER PROMPT — "AI Corp" Web Platform

> Lưu ý quan trọng trước khi dùng prompt này: ba repo bạn nhắc tới —
> `Leonxlnx/taste-skill`, `DietrichGebert/ponytail`, `rohitg00/agentmemory` —
> **không phải là thư viện runtime** để import vào backend của app. Cả ba đều
> là **"skills" cho coding agent** (Claude Code, Cursor, Copilot CLI, Codex...),
> nghĩa là chúng giúp *AI viết code giúp bạn tốt hơn* trong lúc vibe-code, chứ
> không chạy bên trong sản phẩm "AI Corp" lúc production:
> - `taste-skill`: rule-set giúp agent code frontend có "gu" thẩm mỹ, chống UI sến/rập khuôn.
> - `ponytail`: rule-set giúp agent viết code tối giản, không over-engineer.
> - `agentmemory`: hệ thống memory **cho coding agent nhớ giữa các session code**, không phải memory cho nhân vật AI Agent trong app của bạn.
>
> => Prompt dưới đã tách rõ 2 lớp: (1) cách dùng 3 skill này để **hỗ trợ Claude
> Code/Cursor khi build dự án**, và (2) kiến trúc **memory/orchestration thật
> của riêng app "AI Corp"** (tự viết, dùng pgvector + queue/DAG riêng) — không
> nhầm lẫn hai lớp này với nhau.

---

## ROLE

Bạn là **AI Solutions Architect & Senior Full-Stack Engineer**, có kinh nghiệm
sâu về multi-agent systems (LangGraph, AutoGen, CrewAI), real-time systems
(WebSocket/SSE), và frontend Ant Design. Hãy đóng vai trò cố vấn kỹ thuật kiêm
lập trình viên chính cho dự án dưới đây, đưa ra quyết định kiến trúc rõ ràng,
giải thích trade-off, và chỉ code khi tôi xác nhận từng bước.

## PROJECT OVERVIEW

**Tên dự án:** AI Corp
**Ý tưởng:** Một nền tảng mô phỏng "công ty công nghệ ảo" nơi mọi nhân sự là
AI Agent (LLM-driven), tự động hóa toàn bộ pipeline: nhận yêu cầu → lên kế
hoạch → chia task → viết code → review/QA → release → viết nội dung
marketing/báo cáo. Con người chỉ đóng vai **Board of Directors**: nhập Goal
ban đầu, duyệt milestone, can thiệp khi agent bị kẹt (human-in-the-loop).

**Đối tượng dùng:** Founder/PM muốn thử nghiệm ý tưởng sản phẩm nhanh bằng
một "công ty ảo" agent tự vận hành; vừa là demo công nghệ, vừa là dev tool nội bộ.

## TECH STACK (cố định, không đổi nếu không có lý do mạnh)

| Layer | Công nghệ |
|---|---|
| Frontend | Vite + React + TypeScript (strict mode), Ant Design 5.x, Zustand hoặc Redux Toolkit cho state, TanStack Query cho data fetching |
| Realtime | WebSocket (Socket.IO hoặc ws thuần) cho log/chat giữa agent, SSE cho streaming LLM token |
| Backend | Node.js + NestJS (ưu tiên vì có DI, module hóa tốt cho nhiều agent service) — nêu rõ lý do nếu đề xuất đổi sang FastAPI |
| ORM/DB | PostgreSQL + Prisma ORM; **pgvector extension** cho vector search (long-term memory) |
| Queue/Orchestration | BullMQ (Redis) cho task queue giữa agent; tự xây **Agent Graph Engine** dạng DAG (lấy cảm hứng từ LangGraph) để định tuyến CEO→PM→Dev→QA |
| LLM Provider | Anthropic Claude API (model mặc định) hoặc OpenAI, qua một lớp abstraction `ILLMProvider` để dễ đổi provider |
| Auth | NextAuth/Lucia hoặc JWT thuần (dự án nhỏ, không cần phức tạp) |
| Deploy | Docker Compose cho dev (Postgres + Redis + API + Web), hướng tới Railway/Render khi deploy |

## KIẾN TRÚC AGENT (lớp lõi của sản phẩm — tự thiết kế, không phụ thuộc 3 repo trên)

### 1. Agent Memory System
- **Short-term memory**: lưu trong Redis hoặc cột `context_window` (jsonb) gắn theo `task_id`, tự động prune khi vượt token budget.
- **Long-term memory**: bảng `agent_memories` (Postgres + pgvector) lưu embedding của: quy chuẩn công ty (coding convention, brand voice), bài học từ project cũ, feedback lặp lại từ QA. Mỗi Agent role có namespace riêng để tránh "nhớ lẫn" giữa Dev và Marketing.
- Embedding model: dùng API embedding của OpenAI/Voyage, hoặc local (bge-small) nếu muốn không tốn phí.

### 2. Skill & Tool-Calling Layer
- Mỗi Agent có một danh sách `tools` khai báo theo chuẩn function-calling của LLM provider (JSON schema), ví dụ:
  - Dev Agent: `write_file`, `read_file`, `run_terminal_command` (sandbox container riêng, **không** chạy trực tiếp trên host), `run_tests`.
  - QA Agent: `read_file`, `run_tests`, `create_review_comment`.
  - PM Agent: `create_task`, `update_kanban_status`, `assign_task`.
  - Marketing Agent: `web_search`, `draft_content` (không tự động post lên mạng xã hội thật trong MVP — chỉ tạo draft để người duyệt).
- Tool execution chạy trong **sandbox container riêng** (Docker) để an toàn, có timeout và resource limit.

### 3. Orchestration (Agent Graph / DAG)
- Tự xây `WorkflowEngine` đơn giản: mỗi node là 1 agent step, edge là điều kiện chuyển trạng thái (`onSuccess`, `onFail`, `needsHumanApproval`).
- Flow mẫu: `CEO.planMilestones → PM.breakdownTasks → Dev.implement ⇄ QA.review (loop tối đa N lần) → PM.markDone → Marketing.draftAnnouncement → Human.approve`.
- Lưu state của graph vào DB (`workflow_runs`, `workflow_steps`) để có thể resume nếu server restart.

### 4. Cost & Rate-limit Guard
- Middleware đếm token/cost mỗi lần gọi LLM, lưu vào bảng `api_usage_logs`, có ngưỡng cảnh báo/auto-pause khi vượt budget — đây là nhiệm vụ phụ của "HR/Marketing Agent" như ý tưởng gốc.

## DATABASE SCHEMA — YÊU CẦU TỐI THIỂU (Prisma)

Các model bắt buộc: `User` (Board of Directors), `Project`, `Milestone`,
`Task` (Kanban: todo/in_progress/review/done), `Agent` (role, system_prompt,
model_config), `AgentMemory` (vector), `AgentMessage` (log chat giữa agent —
nguồn cho "Phòng họp"), `WorkflowRun`, `WorkflowStep`, `ApiUsageLog`.

## UI/UX YÊU CẦU (Ant Design)

1. **Dashboard tổng quan**: card hiển thị số project đang chạy, tổng chi phí API tháng này, progress bar từng project, biểu đồ chi phí theo agent (dùng `@ant-design/charts` hoặc Recharts).
2. **Virtual Office** (màn hình chính): chia 2 cột —
   - Trái: **Kanban board** (AntD `Card` + drag-drop bằng `dnd-kit`), cột tự cập nhật khi agent đổi status qua WebSocket.
   - Phải: **Phòng họp** — log dạng chat bubble, mỗi agent có avatar/màu riêng, hiển thị "đang suy nghĩ..." (typing indicator) khi agent đang gọi LLM, hỗ trợ filter theo agent.
3. **Agent Detail Drawer**: click vào agent để xem system prompt, memory đã lưu, lịch sử task đã làm.
4. **Human-in-the-loop**: khi workflow cần phê duyệt (ví dụ trước khi merge code hoặc đăng bài marketing), hiển thị Modal yêu cầu Board of Directors Approve/Reject/Comment.

## ACTION PLAN — THỰC HIỆN TỪNG BƯỚC, CHỜ XÁC NHẬN

**Step 0 (chỉ làm 1 lần, ngay bây giờ):** Đề xuất cấu trúc folder monorepo
(ví dụ dùng `pnpm workspaces` hoặc Turborepo: `apps/web`, `apps/api`,
`packages/shared-types`), giải thích lý do chọn NestJS vs FastAPI, và liệt kê
trade-off của BullMQ vs cơ chế DAG tự viết hoàn toàn so với dùng thư viện như
LangGraph.js.

**Step 1:** Khởi tạo `schema.prisma` đầy đủ theo mục Database Schema ở trên +
`docker-compose.yml` (Postgres với pgvector image, Redis) + `package.json`
gốc của monorepo.

**Step 2:** Xây `BaseAgent` abstract class (TypeScript) — có method
`loadMemory()`, `think()`, `act()`, `saveMemory()` — và implement cụ thể 1
agent đơn giản nhất (PM Agent) để demo end-to-end.

**Step 3:** Xây `WorkflowEngine` tối giản cho phép CEO Agent nhận 1 Goal text
từ người dùng, tự tạo Milestone + Task, giao cho PM Agent — log toàn bộ qua
WebSocket.

**Step 4:** Xây Frontend Dashboard + Virtual Office (Kanban + Phòng họp) kết
nối WebSocket nhận log realtime từ Step 3.

**Step 5 (mở rộng sau khi MVP chạy ổn):** Thêm Dev Agent + QA Agent với tool
sandbox thật, thêm Cost Guard, thêm Marketing Agent.

> Trong khi triển khai bằng Claude Code/Cursor, có thể bật các skill hỗ trợ
> coding sau để tăng chất lượng code (không phải dependency của app):
> `npx skills add https://github.com/Leonxlnx/taste-skill` (frontend có gu),
> `npx skills add DietrichGebert/ponytail` (code tối giản, không over-build),
> và `agentmemory connect claude-code` (giúp Claude Code nhớ context giữa các
> session làm việc với chính repo này).

---

**Hãy bắt đầu từ Step 0**, trình bày cấu trúc folder + giải thích trade-off
trước, đợi tôi xác nhận rồi mới viết code cho Step 1.
