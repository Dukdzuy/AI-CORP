# Hiện thực

Chương này mô tả cách thiết kế ở chương 4 được hiện thực: công nghệ, quy mô mã, các đoạn mã tiêu biểu cho từng mẫu chính, giao diện người dùng và cấu hình triển khai.

## Công nghệ và quy mô

| Thành phần | Công nghệ |
|------------|-----------|
| Ngôn ngữ | TypeScript 5 (API, web, dự án sinh ra) |
| API | NestJS 10, Socket.IO, Prisma 5, BullMQ 5, pdfkit, TypeScript compiler API |
| Cơ sở dữ liệu, hàng đợi | PostgreSQL 16 (pgvector), Redis 7 |
| Web | React 18, Vite, Ant Design, TanStack Query, Zustand, Recharts |
| Kiểm thử | Jest + ts-jest (API), Vitest (web), Playwright (giao diện đầu-cuối) |
| LLM | Cổng bất kỳ tương thích OpenAI (`NINE_ROUTER_URL`), nhà cung cấp Anthropic trực tiếp tuỳ chọn |
| Triển khai | Docker (Node 20, nginx 1.27), Docker Compose |
| Tổ chức mã | Monorepo pnpm + Turborepo: `apps/api`, `apps/web`, `packages/shared-types` |

Quy mô tại thời điểm viết (đếm tự động, không tính tệp kiểm thử):

| Phần | Tệp | Dòng |
|------|----:|-----:|
| API (`apps/api/src`) | 326 | 27 336 |
| trong đó tầng miền (`src/domain`) | 101 | 6 893 |
| Web (`apps/web/src`) | 70 | 7 671 |
| Tệp kiểm thử API | 47 | — |

API có 26 mô-đun NestJS và 277 lớp được xuất (`export class`).

## Tầng miền

Tầng miền chia theo khái niệm: `entities` (Project, Task, Milestone, Agent…), `value-objects` (Money, ProjectStatus…), `repositories` (giao diện), `events` (sự kiện miền và `EventBus`), `agent` (máy trạng thái, bộ phát sự kiện, giao diện chiến lược, học), `workflow` (đồ thị, bộ giải phụ thuộc, phiên bản ngữ nghĩa, memento), `security`, `audit`, `integration`, `reporting`, `analytics`, `estimation`, `quality`, `collaboration`.

Thực thể bảo vệ bất biến của mình. Ví dụ, `Task.transitionTo` chỉ cho phép các chuyển trạng thái hợp lệ (todo → in_progress → review → done, review → in_progress khi QA từ chối), và `Money` không cho giá trị âm. Kiểm thử miền từng phát hiện `Task.getCostVariance()` ném ngoại lệ với mọi công việc dưới ngân sách vì chênh lệch âm không biểu diễn được bằng `Money`; hàm đã được sửa để trả về số đô-la có dấu.

```typescript
// apps/api/src/domain/repositories/IProjectRepository.ts (rút gọn)
export interface IProjectRepository {
  findById(id: string): Promise<ProjectDTO | null>;
  findAll(options?: { orderBy?: 'createdAt' | 'updatedAt'; order?: 'asc' | 'desc' }): Promise<ProjectDTO[]>;
  create(data: CreateProjectData): Promise<ProjectDTO>;
  update(id: string, data: UpdateProjectData): Promise<ProjectDTO>;
}
```

Hiện thực `PrismaProjectRepository` nằm ở `src/infrastructure/persistence` và chỉ chọn các cột mà DTO cần; kiểm thử tải từng phát hiện danh sách dự án tải cả ngữ cảnh JSON của lượt chạy mới nhất rồi bỏ đi (46 → 9 ms sau khi sửa).

## Tác tử

```typescript
// apps/api/src/modules/agents/base.agent.ts (rút gọn)
async execute(input: AgentContext): Promise<AgentResult<TOutput>> {
  const context = this.prepareContext(input);          // loại công việc theo RoleProfile
  const lifecycle = new AgentStateMachine(AgentState.IDLE); // một máy trạng thái mỗi lần chạy
  this.running.add(lifecycle);
  try {
    await this.publish(new TaskAssignedEvent(/* … */));
    this.transition(lifecycle, AgentState.THINKING, 'Starting thought process');
    const thought = await this.thinkingStrategy.think(context);   // Strategy
    this.transition(lifecycle, AgentState.ACTING, 'Executing action');
    const action = await this.actionStrategy.act(context, thought); // Strategy
    this.transition(lifecycle, AgentState.COMPLETED, 'Done');
    // lưu ký ức, phát AgentCompletedTaskEvent, quay về IDLE …
  } catch (error) {
    this.transition(lifecycle, AgentState.ERROR, (error as Error).message);
    // …
  } finally {
    this.running.delete(lifecycle);
  }
}
```

Mỗi vai trò có một tệp hồ sơ trong `modules/agents/profiles` và hai chiến lược trong `modules/agents/strategies`. Danh sách tác tử được NestJS tiêm qua token `AGENTS`; `AgentOrchestrator` dựng một bảng tra theo vai trò và báo lỗi nếu hai tác tử trùng vai trò. Như vậy, thêm một vai trò thứ chín gồm: thêm giá trị `AgentRole`, một hồ sơ, hai chiến lược và một dòng đăng ký nhà cung cấp; bộ điều phối và bộ máy quy trình không đổi.

Các chiến lược hành động của BA, Architect, DEV và QC ghi sản phẩm qua `ProjectWorkspace`. `OoadArtifactService` (Facade) dựng tài liệu và khung mã từ mẫu Handlebars; nội dung do LLM trả về được tách thành các khối `<CODE filepath="...">` và từng đường dẫn được kiểm tra trước khi ghi.

## Bộ máy quy trình

`WorkflowEngine` giữ một bảng `type → NodeExecutionStrategy`. Khi có Redis, mỗi nút là một công việc BullMQ (đồng thời tối đa 5); khi không, nút được thực thi trực tiếp. Kết thúc mỗi nút, `handleJobCompletion` ghi bước với thời lượng, chụp memento, chọn cạnh kế tiếp; khi nút thất bại sau các lần thử, kết quả được chuyển thành `failure` để lượt chạy đi theo `onFail` hoặc kết thúc ở `failed`.

Các mẫu quy trình là lớp con của `WorkflowTemplate` với danh sách tham số có kiểu (số, chuỗi, enum, boolean) được kiểm tra trước khi dựng định nghĩa. Ví dụ, mẫu *backend REST API* có tham số `database` kiểu enum; giá trị được truyền vào lời nhắc thiết kế của Architect như một ràng buộc của nút, nên các Repository được thiết kế cho đúng cơ sở dữ liệu đã chọn.

## Tính năng doanh nghiệp

- **Phân quyền:** `@RequirePermission(Permission.PROJECT_CREATE)` trên controller; quyền của vai trò lấy từ `shared-types` để web và API dùng chung một định nghĩa. Giao diện ẩn hành động người dùng không có quyền (ví dụ nút *New Project* với người xem) nhưng API vẫn kiểm tra độc lập.
- **Kiểm toán:** `@Audited({ action: 'approval.approve', resourceType: 'Approval', idParam: 'id' })` trên route; interceptor ghi kết quả *ok* hoặc *denied* kèm IP; nhật ký có bộ lọc, phân trang và xuất CSV (ô bắt đầu bằng `=`, `+`, `-`, `@` được thoát để chống chèn công thức).
- **Xuất báo cáo:** JSON, CSV và PDF (pdfkit, phông có dấu tiếng Việt); báo cáo tuần được ghi vào thư mục `reports/` của dự án thay vì gửi email.

## Giao diện người dùng

Ứng dụng web (nhãn giao diện bằng tiếng Anh) có các màn hình: Bảng điều khiển (danh sách dự án, chi phí), Văn phòng ảo (trạng thái tám tác tử theo thời gian thực và Phòng họp), Chi tiết dự án (kết quả, Sản phẩm, Báo cáo, Kanban, Mốc, Lượt chạy), Phân tích tác tử, Người dùng và vai trò, Nhật ký kiểm toán, Tích hợp. Tab *Artifacts* (Sản phẩm) hiển thị tóm tắt OOAD, kết quả cổng chất lượng, cây tệp của dự án, trình xem Markdown, mã và sơ đồ PlantUML (render bởi máy chủ PlantUML nội bộ), và nút tải toàn bộ dự án dạng zip.

![Tab Sản phẩm của dự án Online Bookstore](../phase7-e2e/demo-artifacts.png){.wide}

Trong lúc chuẩn bị trình diễn, hai lỗi hiển thị được phát hiện và sửa: thẻ dự án luôn ghi "Starting… 0%" vì danh sách dự án không kèm lượt chạy (nay dùng trạng thái dự án khi không có lượt chạy, có kiểm thử đơn vị), và tổng chi phí hiển thị số thực chưa làm tròn.

## Cấu hình triển khai

- `apps/api/Dockerfile`: hai giai đoạn; giai đoạn build cài phụ thuộc, sinh Prisma client, build API và script seed; giai đoạn chạy dùng `tini`, chạy bằng người dùng `node`, có phông DejaVu cho PDF và HEALTHCHECK gọi `/api/health/live`. `docker-entrypoint.sh` chạy `prisma migrate deploy` rồi khởi động.
- `apps/web/Dockerfile`: build với `VITE_API_URL=/api`, `VITE_WS_URL=/`, `VITE_PLANTUML_SERVER=/plantuml` để mọi lời gọi cùng nguồn gốc qua nginx.
- `docker-compose.prod.yml` và `.env.production.example`: sáu dịch vụ (một chỉ chạy ở hồ sơ demo), ba volume, chỉ công bố cổng web.

Việc chuẩn bị triển khai phát hiện bốn lỗi khiến cấu hình cũ không thể chạy: thư mục migration chỉ có lược đồ ban đầu (thiếu 8 bảng và nhiều cột, vì quá trình phát triển dùng `prisma db push`) và tệp khoá migration nằm sai chỗ; cấu hình nginx bỏ tiền tố `/api` nên mọi lời gọi API trả 404 và không chuyển tiếp WebSocket; Dockerfile của API gọi health ở đường dẫn sai và chạy tệp không tồn tại. Cả bốn đã được sửa và kiểm chứng (mục 6.3).
