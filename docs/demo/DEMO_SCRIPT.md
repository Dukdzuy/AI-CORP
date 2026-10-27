# Kịch bản demo bảo vệ luận văn (15 phút)

**Đề tài:** Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation

Kịch bản này dùng dữ liệu demo dựng sẵn (`scripts/demo/seed-demo.mjs`) và LLM kịch bản (`scripts/demo/demo-llm.cjs`), nên mọi bước đều lặp lại được, không phụ thuộc mạng hay khóa API. Mọi con số dưới đây là số đo thật trong repo (nguồn ghi ở cột cuối của bảng *Số liệu*).

---

## 1. Chuẩn bị (trước buổi bảo vệ)

### Cách A: Docker (máy demo có Docker)

```bash
cp .env.production.example .env.production
# Sửa các CHANGE_ME: POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32),
# NINE_ROUTER_API_KEY (giá trị bất kỳ khi dùng LLM kịch bản), SEED_ADMIN_PASSWORD (>= 12 ký tự)
docker compose -f docker-compose.prod.yml --env-file .env.production --profile demo up -d --build
# Đợi web lên ở http://localhost:8080, rồi dựng dữ liệu demo:
DEMO_ADMIN_PASSWORD='<SEED_ADMIN_PASSWORD>' node scripts/demo/seed-demo.mjs http://localhost:8080/api
```

Sau lần chạy đầu, đặt `SEED_ON_START=false` trong `.env.production`.

### Cách B: Không Docker (máy phát triển)

```bash
# PostgreSQL (có pgvector) + Redis đang chạy
cd apps/api && npx prisma migrate deploy && npm run db:seed && npx nest build
node ../../scripts/demo/demo-llm.cjs &                      # LLM kịch bản ở cổng 20128
NINE_ROUTER_URL=http://127.0.0.1:20128/v1 NINE_ROUTER_API_KEY=demo \
SANDBOX_ALLOW_LOCAL_RUN=true node dist/main.js &
cd ../web && npx vite &                                      # http://localhost:5173
node ../../scripts/demo/seed-demo.mjs                        # dữ liệu demo
```

### Kết quả mong đợi của `seed-demo.mjs` (khoảng 25 giây)

| Dự án | Trạng thái | Dùng để trình bày |
|-------|-----------|-------------------|
| Online Bookstore | completed | Toàn bộ quy trình OOAD: use case, mô hình miền, UML, mã phân lớp, kiểm thử chấp nhận, ma trận truy vết, marketing |
| Legacy Billing | completed | Chất lượng mã: lần đầu DEV viết mã vi phạm phân lớp và dùng `eval`, tự sửa một vòng trước khi QA duyệt (điểm 77 → 100) |
| Unsafe Portal | completed | QA từ chối mã (`eval` trong tầng domain), quy trình quay lại DEV, lần hai đạt |
| Library Loans (design) | completed | Mẫu quy trình chỉ phân tích và thiết kế |
| Clinic Booking | awaiting approval | Chờ thành viên hội đồng quản trị duyệt: duyệt trực tiếp trong buổi demo |

Tài khoản: `board@aicorp.demo` (board member) và `viewer@aicorp.demo` (viewer), mật khẩu `demo-2026`; admin theo `SEED_ADMIN_PASSWORD`.

### Kiểm tra trước giờ G (5 phút)

- [ ] `curl http://localhost:8080/api/health` trả `"status":"healthy"` với database, redis, ninerouter đều healthy
- [ ] Đăng nhập được bằng `board@aicorp.demo`; góc trên phải hiện **Connected** (WebSocket qua nginx)
- [ ] Dashboard có đủ 5 dự án; *Clinic Booking* đang chờ duyệt
- [ ] Mở sẵn 3 tab: Dashboard, Virtual Office, Agent Analytics
- [ ] Mở sẵn file `docs/diagrams/rendered/architecture/component-diagram.svg` và `classes/patterns-strategy.svg`
- [ ] Đặt `DEMO_LLM_DELAY_MS=800` nếu muốn khán giả thấy rõ từng agent "suy nghĩ" (mặc định 400 ms)

---

## 2. Dòng thời gian 15 phút

### 0:00 – 1:00 · Giới thiệu

- Bài toán: một dự án phần mềm cần nhiều vai trò (phân tích, thiết kế, lập trình, kiểm thử, kiểm soát chất lượng) và tài liệu OOAD nhất quán với mã. AI-CORP tự động hoá chuỗi đó bằng 8 agent, mỗi agent một vai trò.
- Đóng góp chính: nền tảng được thiết kế theo OOAD **và** mọi dự án nó sinh ra cũng theo OOAD (use case → mô hình miền → UML → mã phân lớp → kiểm thử theo use case → ma trận truy vết).

### 1:00 – 3:00 · Kiến trúc

- Mở **sơ đồ thành phần** (component diagram): 4 tầng presentation / application / domain / infrastructure; domain không phụ thuộc framework.
- Mở **sơ đồ Strategy**: mỗi agent là `BaseAgent` (Template Method: assign → think → act → complete) cộng hai strategy được tiêm vào; thêm vai trò mới không sửa engine (OCP).
- Nhắc số liệu: 26 module NestJS, 101 file domain, 39 sơ đồ UML render được, các pattern GoF/enterprise được gắn nhãn `@pattern` trong mã.

### 3:00 – 6:00 · Demo 1: Tạo dự án và xem các agent làm việc

1. Đăng nhập `board@aicorp.demo`.
2. **New Project** → chọn mẫu *OOAD software project* → tên "E-commerce Platform", mô tả 2–3 câu → tạo.
3. Chuyển sang **Virtual Office**: CEO → BA → Architect lần lượt chuyển trạng thái; Meeting Room hiện tin nhắn giữa các agent.
4. Quay lại dự án → tab **Workflow Runs**: sub-workflow *analysis & design* → cổng chất lượng OOAD (ooad_gate) → PM → *build & verify* (DEV → QC → QA).
5. Điểm nói: cổng OOAD chặn thiết kế thiếu use case / thực thể / pattern và gửi lại cho Architect.

### 6:00 – 9:00 · Demo 2: Sản phẩm của agent và chất lượng

1. Mở **Online Bookstore** → tab **Artifacts**: tóm tắt OOAD (5 use case, 3 thực thể, 3 pattern, cổng 100%), cây 35 file, xem `docs/use-cases.md`, sơ đồ lớp, `src/domain/...`, `tests/UC-001.spec.ts`, `docs/traceability-matrix.md` (4/5 use case có test chạy đạt; UC-005 thiếu test và hệ thống nói rõ điều đó).
2. Mở **Legacy Billing** → tab **Reports** → thẻ *Code quality (static analysis)*: điểm sau khi sửa; tab *Artifacts* → `docs/code-quality.md` ghi "Score before refinement: 77. Refined: src/domain/entities/Order.ts". Giải thích: phân tích bằng TypeScript compiler API (độ phức tạp McCabe, chỉ số bảo trì, vi phạm phân lớp, `eval`, bí mật lộ), dự đoán QA sẽ từ chối, DEV sửa đúng một vòng.
3. Mở **Unsafe Portal** → **Workflow Runs**: QA trả lời FAIL, quy trình quay lại DEV, lần hai PASS.

### 9:00 – 11:00 · Demo 3: Tính năng doanh nghiệp

1. Mở **Clinic Booking**, nút duyệt chờ sẵn → **Approve** → CEO đóng dự án (trạng thái chuyển *completed*).
2. Đăng xuất, đăng nhập `viewer@aicorp.demo`: không có nút *New Project*, không duyệt được (API trả 403).
3. Đăng nhập admin → **Audit log**: thấy `approval.approve`, `access.denied`, `project.create`, các bước của agent.
4. **Reports** của dự án → *Export PDF*.
5. (Nếu còn thời gian) **Workflow Runs** → snapshot → rollback (Memento) trên một run đang tạm dừng.

### 11:00 – 13:00 · Demo 4: Phân tích và dự báo

1. **Agent Analytics**: bảng xếp hạng 8 vai trò, chất lượng theo từng vai trò (DEV theo tỉ lệ QA duyệt, QC theo kết quả test, Architect theo cổng OOAD), heatmap, cảnh báo bất thường.
2. Thẻ *Estimation model*: hồi quy ridge theo vai trò, sai số leave-one-out; mở **Reports** của một dự án để xem dự báo so với thực tế.
3. Nói rõ giới hạn: dữ liệu huấn luyện là các dự án đã chạy trong hệ thống, nên dự báo luôn được so với kết quả thay vì được tin tuyệt đối.

### 13:00 – 14:00 · Kết quả

Đọc bảng *Số liệu* (mục 3), nhấn mạnh rằng mọi con số lấy từ lần chạy có lưu vết trong repo.

### 14:00 – 15:00 · Hỏi đáp

Xem mục 5.

---

## 3. Số liệu dùng khi trình bày

| Chỉ số | Giá trị | Nguồn |
|--------|---------|-------|
| Kiểm thử đơn vị/tích hợp API | 47 bộ, 674 test đạt, 15 bỏ qua (cần Docker) | `npx jest` (`apps/api`) |
| Độ bao phủ tầng domain | dòng 97,1% · lệnh 96,6% · hàm 97,2% · nhánh 89,6% (cổng: 90/90/90/85) | `npm run test:cov` |
| Độ bao phủ toàn API | lệnh 77,2% · dòng 77,0% · hàm 75,2% · nhánh 63,7% | `npm run test:cov` |
| Kiểm thử web | 41 test (Vitest) | `npx vitest run` (`apps/web`) |
| Kiểm thử đầu-cuối | 20/20 (triển khai production + demo), 21/21 (phân tích, dự báo, chất lượng mã), 44/44 (bảo mật, audit, tích hợp) | `docs/phase7-e2e`, `docs/phase6-e2e`, `docs/phase5-e2e` |
| Thời gian xử lý một nút quy trình (không tính độ trễ LLM thật) | p50 108 ms · p95 1,69 s · p99 1,73 s (nút chậm nhất là QC chạy Jest) | 43 bước, `docs/phase7-e2e/README.md` |
| Tải 20 người dùng đồng thời | 201,8 req/s, 0% lỗi, p95 ≤ 404 ms mọi endpoint | `docs/phase6-e2e/load-test.md` |
| Sai số dự báo thời gian agent (leave-one-out) | Architect 3%, CEO 5%, BA 11%, DEV 30% | `docs/phase6-e2e/README.md` |
| Sơ đồ UML | 39 sơ đồ, 6 góc nhìn, render tự động | `docs/diagrams/INDEX.md` |
| Use case nền tảng | 31 use case đặc tả; 117 yêu cầu ở trạng thái *Implemented* trong ma trận truy vết | `docs/requirements/` |

Không dùng các con số trong bản kế hoạch ban đầu (92% coverage, cải thiện 15% nhờ học, 50 dự án/giây): chúng chưa từng được đo.

---

## 4. Phương án dự phòng

| Sự cố | Cách xử lý |
|--------|-----------|
| Dự án mới chạy chậm hoặc treo | Dùng *Online Bookstore* đã hoàn tất để trình bày phần còn lại; kiểm tra `GET /api/health` |
| Mất kết nối WebSocket (Virtual Office không cập nhật) | Tải lại trang; trạng thái quy trình vẫn xem được ở tab *Workflow Runs* |
| Lỡ duyệt *Clinic Booking* trước giờ demo | Tạo dự án mới với mẫu có *Human approval* bật, hoặc chạy lại `seed-demo.mjs` trên cơ sở dữ liệu mới |
| Máy demo hỏng | Video dự phòng (mục 6) và ảnh chụp trong `docs/phase7-e2e/` |
| Chạy lại trên cơ sở dữ liệu trống | Khởi động lại `demo-llm` (hoặc để `seed-demo.mjs` tự gửi `reset`) rồi chạy lại `seed-demo.mjs` |

---

## 5. Câu hỏi thường gặp và gợi ý trả lời

- **Agent có thật sự dùng LLM không, hay chỉ là kịch bản?** Nền tảng gọi bất kỳ gateway tương thích OpenAI nào qua `NINE_ROUTER_URL`. Buổi demo và các lần đo dùng LLM kịch bản để lặp lại được; đổi sang gateway thật chỉ là đổi biến môi trường. Chất lượng đầu ra khi dùng LLM thật phụ thuộc mô hình, đây là giới hạn đã nêu trong luận văn.
- **Vì sao bỏ vai trò DevOps và thêm QC?** Sản phẩm của nền tảng là dự án được phân tích, thiết kế, hiện thực và kiểm thử; DevOps không có đầu ra kiểm chứng được. QA (quy trình) và QC (sản phẩm) tách theo định nghĩa quản lý chất lượng: QA giữ cổng OOAD và rà soát thiết kế, QC viết và chạy kiểm thử theo use case.
- **Làm sao biết mã sinh ra tuân thủ thiết kế?** Ba lớp kiểm tra: cổng OOAD sau thiết kế, phân tích tĩnh (vi phạm phân lớp domain ← application ← infrastructure) trước QA, và kiểm thử chấp nhận theo từng use case với ma trận truy vết.
- **Học của agent đo thế nào?** Mỗi kết quả được chấm (cổng OOAD, test QC, phán quyết QA) và định kỳ được tinh luyện thành bài học đưa vào prompt lần sau. Hệ thống ghi lại cơ chế này; đánh giá định lượng mức cải thiện với LLM thật là hướng phát triển.
- **Mở rộng thêm vai trò agent?** Thêm một `RoleProfile` và hai strategy, đăng ký vào registry; engine và các agent khác không đổi.

---

## 6. Video dự phòng

`docs/demo/record-walkthrough.cjs` ghi lại (Playwright) một lượt đi qua các màn hình chính trên stack demo, không lời thoại. Thu âm thuyết minh riêng rồi ghép nếu cần.

```bash
node docs/demo/record-walkthrough.cjs http://localhost:8080 docs/demo/video
```
