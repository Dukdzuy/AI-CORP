# PROMPT BỔ SUNG — Tích hợp 9Router vào "AI Corp"

> Bối cảnh đã xác minh: **9Router** (`decolua/9router`) là một **local proxy/gateway
> mã nguồn mở**, expose một endpoint **OpenAI-compatible duy nhất** tại
> `http://localhost:20128/v1`, đứng giữa các coding tool / app của bạn và 40-60+
> LLM provider (Claude, GPT, Gemini, GLM, MiniMax, Kiro, OpenCode Free, Vertex...).
> Cơ chế chính:
> - **3-tier auto fallback**: Tier 1 (subscription đã có) → Tier 2 (API rẻ) → Tier 3
>   (free providers như Kiro/OpenCode Free/Vertex) — tự chuyển khi gặp rate-limit/hết quota.
> - **RTK Token Saver**: tự nén output dạng tool-call (git diff, grep, ls, log...) trước
>   khi gửi tới LLM, giảm 20-40% input token.
> - Hiện bạn đang dùng **provider "OpenCode Free"** trong 9Router (no-auth, model
>   auto-fetch từ opencode.ai) — đây là 1 trong các route Tier 3 free.
>
> => Vì 9Router expose API dạng **OpenAI-compatible**, việc tích hợp vào "AI Corp"
> chỉ là: đổi `baseURL` của LLM client sang `http://localhost:20128/v1`, dùng API key
> lấy từ dashboard 9Router. Toàn bộ Agent (CEO/PM/Dev/QA/Marketing) trong app sẽ
> gọi LLM qua lớp abstraction `ILLMProvider` đã thiết kế trước đó — giờ chỉ cần thêm
> 1 implementation mới: `NineRouterProvider`.

---

## ROLE

Tiếp tục vai trò **AI Solutions Architect & Senior Full-Stack Engineer** của dự án
"AI Corp" (Vite + React + TS + AntD + NestJS + Prisma/Postgres+pgvector + BullMQ).
Nhiệm vụ lần này: tích hợp **9Router** làm lớp LLM Gateway trung gian cho toàn bộ
Agent trong hệ thống, thay cho việc gọi trực tiếp Anthropic/OpenAI API.

## MỤC TIÊU TÍCH HỢP

1. Tất cả LLM call của mọi Agent (CEO, PM, Dev, QA, Marketing) đi qua 9Router
   (`localhost:20128/v1`) thay vì gọi trực tiếp provider — để tận dụng fallback
   3-tier và RTK Token Saver có sẵn.
2. Giữ khả năng **đổi model/provider theo từng Agent** mà không sửa code logic
   nghiệp vụ (ví dụ: CEO Agent dùng model mạnh hơn cho planning, Dev Agent dùng
   model rẻ/free qua OpenCode Free cho các task code đơn giản, QA Agent có thể
   route khác).
3. Đảm bảo khi 9Router fallback sang provider khác (đổi model giữa request),
   hệ thống AI Corp **vẫn log đúng** model/provider thực tế đã trả lời vào
   `ApiUsageLog` (không log sai do tưởng đang dùng model A nhưng 9Router đã
   fallback qua model B).
4. Tận dụng RTK Token Saver cho các tool-call output lớn của Dev Agent (kết quả
   `run_terminal_command`, `run_tests`, diff code) — vì đây đúng loại dữ liệu
   RTK được thiết kế để nén.
5. Có cấu hình **graceful fallback nội bộ của app**: nếu 9Router tự nó down/không
   reachable (process local bị tắt), AI Corp phải tự fallback gọi trực tiếp
   Anthropic API (không để toàn hệ thống agent đứng im).

## YÊU CẦU KỸ THUẬT CỤ THỂ

### 1. Lớp Provider Abstraction (đã có `ILLMProvider`, mở rộng thêm)

```ts
interface ILLMProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  // ChatResult phải trả về thêm: actualModelUsed, actualProvider, tokenUsage
}
```

- Tạo `NineRouterProvider implements ILLMProvider`:
  - `baseURL`: lấy từ env `NINEROUTER_BASE_URL` (default `http://localhost:20128/v1`)
  - `apiKey`: lấy từ env `NINEROUTER_API_KEY` (key tạo trong dashboard 9Router)
  - Dùng OpenAI SDK chuẩn (vì 9Router OpenAI-compatible) — không cần viết HTTP client riêng.
  - Đọc response header/body mà 9Router trả về model/provider thực tế đã dùng (nêu rõ
    trong response của 9Router thường có field này) để ghi log chính xác — nếu field
    không tồn tại, fallback dùng model đã request làm giá trị log gần đúng và đánh dấu
    `is_estimated: true`.

- Tạo `AnthropicDirectProvider implements ILLMProvider` làm **fallback provider của tầng app**
  (khác với fallback tier của 9Router) — chỉ kích hoạt khi health-check tới
  `localhost:20128/health` thất bại liên tiếp N lần.

### 2. Cấu hình per-Agent model routing

Thêm cột `model_route_config` (jsonb) vào bảng `Agent`:
```json
{
  "provider": "ninerouter",
  "model": "claude-sonnet-4-6",        // model alias gửi cho 9Router
  "fallbackProvider": "anthropic-direct",
  "tags": ["tier1-preferred"]
}
```
→ CEO/QA Agent ưu tiên model mạnh (tier 1 trong 9Router); Dev Agent task code
đơn giản có thể set model alias trỏ về route OpenCode Free để tiết kiệm; cho phép
đổi cấu hình này qua Agent Detail Drawer ở UI (không cần deploy lại).

### 3. Health-check & Circuit breaker
- Module `NineRouterHealthService`: ping `GET /health` (hoặc endpoint health của
  9Router) mỗi X giây, lưu state `UP/DOWN` vào cache (Redis), expose qua
  `/api/system/llm-gateway-status` để Dashboard hiển thị badge "9Router: Online/Offline".
- `LLMProviderFactory` đọc state này để quyết định route `NineRouterProvider` hay
  `AnthropicDirectProvider` — implement theo pattern circuit breaker đơn giản
  (đóng mạch sau N lỗi liên tiếp, thử lại sau cooldown).

### 4. Token usage & cost logging chính xác
- Sửa `ApiUsageLog` schema thêm cột: `requested_model`, `actual_model_used`,
  `actual_provider`, `is_fallback_triggered: boolean`, `rtk_token_saved` (nullable,
  nếu 9Router trả về số liệu nén).
- Cost Guard (đã thiết kế ở bước trước) phải tính cost dựa theo `actual_model_used`,
  không phải `requested_model`, để báo cáo chi phí đúng thực tế khi 9Router fallback.

### 5. Bảo mật & vận hành
- 9Router hiện chạy local/dev (`localhost:20128`) — khi deploy AI Corp lên VPS/Cloud,
  cần tính phương án: (a) chạy 9Router cùng VPS qua Docker (image có sẵn trên Docker
  Hub `decolua/9router`) trong cùng Docker Compose network với backend AI Corp, hoặc
  (b) qua Cloudflare Tunnel nếu 9Router chạy máy khác. Đề xuất phương án (a) cho MVP
  vì đơn giản, cùng network nội bộ Docker, không expose port ra ngoài.
- Lưu ý bảo mật: 9Router là **MITM proxy thấy toàn bộ prompt + tool output** — không
  gửi secret/credential thật của khách hàng qua các Agent tool-call nếu route qua
  free-tier provider (Kiro/OpenCode Free) vì đây là dịch vụ bên thứ ba miễn phí,
  không có SLA — chỉ nên dùng cho task không nhạy cảm hoặc môi trường dev/demo.

## ACTION PLAN — TÍCH HỢP THEO TỪNG BƯỚC

**Step A:** Viết `NineRouterProvider` + `AnthropicDirectProvider`, cấu hình env
(`.env.example` cập nhật `NINEROUTER_BASE_URL`, `NINEROUTER_API_KEY`,
`NINEROUTER_HEALTHCHECK_INTERVAL_MS`). Viết 1 script test nhanh gọi thử CEO Agent
qua 9Router để xác nhận kết nối OK.

**Step B:** Thêm `model_route_config` vào schema Agent + migration Prisma, cập nhật
seed data cho 5 agent role với route mẫu khác nhau (1 agent route qua Tier free để
demo rõ sự khác biệt).

**Step C:** Implement `NineRouterHealthService` + circuit breaker trong
`LLMProviderFactory`, thêm badge trạng thái lên Dashboard (AntD `Badge`/`Tag`).

**Step D:** Cập nhật `ApiUsageLog` schema + Cost Guard tính cost theo
`actual_model_used`; hiển thị biểu đồ "request nào bị fallback" trên Dashboard.

**Step E:** Viết tài liệu vận hành ngắn (`docs/ninerouter-setup.md`): cách chạy
9Router qua Docker Compose cùng AI Corp, cách lấy API key từ dashboard 9Router,
cách bật/tắt provider OpenCode Free.

---

**Hãy bắt đầu từ Step A**, viết code `NineRouterProvider` và
`AnthropicDirectProvider` trước, kèm giải thích cách 9Router trả model/provider
thực tế trong response để mình xác nhận field đó tồn tại đúng như mô tả trước khi
viết phần logging ở Step D.
