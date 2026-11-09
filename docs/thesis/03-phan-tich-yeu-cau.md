# Phân tích yêu cầu

Chương này xác định những đối tượng sử dụng nền tảng, các chức năng nền tảng phải cung cấp và các yêu cầu chất lượng nền tảng phải đạt. Đặc tả đầy đủ của 31 use case nằm trong tệp `docs/requirements/use-cases.md`; ma trận truy vết từ yêu cầu đến use case, thiết kế, mã nguồn và kiểm thử nằm trong tệp `docs/requirements/traceability-matrix.md`. Nội dung chương tóm tắt các tài liệu này và phân tích những quyết định chính.

## Tác nhân và vai trò tác tử

Nền tảng có hai loại tác nhân là con người và tác tử AI.

**Tác nhân con người.** Nền tảng phân quyền theo vai trò (RBAC) [47] với ba vai trò như trong bảng sau.

| Vai trò | Quyền chính |
|---------|-------------|
| Quản trị viên (admin) | Quản lý người dùng và vai trò, cấu hình mô hình LLM cho tác tử, xem nhật ký kiểm toán, quản lý khoá API và webhook của mọi người, theo dõi sức khoẻ hệ thống |
| Thành viên hội đồng quản trị (board member) | Tạo và sở hữu dự án, duyệt hoặc từ chối các bước cần con người, xem chi phí, báo cáo và phân tích, xuất dữ liệu, quản lý khoá API và webhook của mình |
| Người xem (viewer) | Chỉ đọc: xem dự án, báo cáo và tài liệu sinh ra |

Bên cạnh vai trò, mỗi dự án có một chủ sở hữu. Thành viên hội đồng quản trị chỉ xử lý được các yêu cầu phê duyệt được giao cho mình và chỉ chỉnh sửa được dự án của mình. Tác tử AI không phải là người dùng đăng nhập; mọi hành động của tác tử được ghi vào nhật ký kiểm toán với loại tác nhân `agent`.

**Tác tử AI.** Nền tảng ban đầu có năm tác tử. Việc rà soát lại các vai trò dẫn đến ba thay đổi sau:

1. Bổ sung hai tác tử BA và Architect, vì một quy trình OOAD cần có người viết use case và người xây dựng mô hình miền trước khi lập kế hoạch.
2. Loại bỏ tác tử DevOps. Sản phẩm của nền tảng là một dự án đã được phân tích, thiết kế, hiện thực và kiểm thử; việc triển khai dự án đó không thuộc phạm vi. Trong nền tảng ban đầu, tác tử DevOps chưa từng được đưa vào quy trình, chỉ sinh ra văn bản không được sử dụng, và sandbox cũng không có mạng hay ổ lưu trữ để triển khai. Nếu giữ lại, tác tử này sẽ là một vai trò không có đầu ra kiểm chứng được và kéo phạm vi đề tài sang CI/CD.
3. Tách riêng QA và QC theo định nghĩa của ISO 9000 [53]. Tác tử QA cũ đảm nhận cả hai nhiệm vụ và trên thực tế không hoàn thành tốt nhiệm vụ nào.

| Tác tử | Trách nhiệm | Đầu ra kiểm chứng được |
|--------|-------------|------------------------|
| CEO | Định hướng, chia mốc, đóng dự án | Mốc (milestone), báo cáo đóng dự án |
| BA | Phân tích yêu cầu | `docs/use-cases.md` (use case có ID, tác nhân, luồng chính, luồng thay thế, tiêu chí chấp nhận) |
| Architect | Thiết kế | Mô hình miền, sơ đồ use case, lớp, tuần tự (PlantUML), `docs/architecture-patterns.md`, khung mã phân lớp |
| PM | Lập kế hoạch | Một công việc cho mỗi use case đã duyệt, có ước lượng chi phí |
| DEV | Hiện thực | Mã TypeScript theo bốn tầng, chú thích `UC-xxx` |
| QC (sản phẩm) | Kiểm soát chất lượng | `tests/UC-xxx.spec.ts`, kết quả chạy Jest, `docs/traceability-matrix.md`, độ bao phủ use case |
| QA (quy trình) | Đảm bảo chất lượng | Cổng OOAD sau thiết kế, rà soát mã so với thiết kế, phán quyết PASS/FAIL điều khiển vòng lặp về DEV |
| Marketing | Truyền thông | Thông báo sản phẩm |

## Yêu cầu chức năng

Các yêu cầu chức năng được chia thành bốn nhóm lớn (mã trong ngoặc là mã nhóm trong ma trận truy vết).

**Hệ thống tác tử (FR1).** Nhóm này gồm tám vai trò tác tử nêu trên; khả năng học từ các kết quả trước thông qua bộ nhớ đã được chắt lọc; khả năng cộng tác theo các mẫu lập trình cặp và chuỗi rà soát; và khả năng giao việc con cho nhau qua bus thông điệp.

**Bộ máy quy trình (FR2).** Nhóm này gồm quy trình con và lồng ghép quy trình; phiên bản bất biến và khôi phục về ảnh chụp trạng thái; thực thi song song có giải quyết phụ thuộc; và các mẫu quy trình có tham số định kiểu.

**Tính năng doanh nghiệp (FR3).** Nhóm này gồm RBAC với quyền chi tiết và quyền sở hữu dự án; nhật ký kiểm toán đầy đủ; API tích hợp cho công cụ bên ngoài (khoá API, webhook); xuất dữ liệu và báo cáo; quản lý nhà cung cấp và mô hình LLM ngay trong ứng dụng, với khoá API được mã hoá; và điều khiển lượt chạy (tạm dừng, tiếp tục, huỷ) có ràng buộc về ngân sách và phê duyệt.

**Tính năng AI/ML (FR4).** Nhóm này gồm phân tích hiệu năng và quá trình học của tác tử; mô hình ước lượng dựa trên dữ liệu lịch sử; dự đoán chất lượng mã bằng phân tích tĩnh; và gợi ý tối ưu dựa trên các bất thường phát hiện được.

Ma trận truy vết có tổng cộng 124 yêu cầu chức năng và phi chức năng, trong đó 115 yêu cầu ở trạng thái *Implemented*, 1 yêu cầu ở trạng thái *Partial* và 8 yêu cầu ở trạng thái *Planned*. Các yêu cầu chưa thực hiện được giữ lại trong ma trận và ghi rõ trạng thái. Mỗi yêu cầu đã hiện thực đều trỏ đến tệp mã nguồn và tệp kiểm thử tương ứng.

## Yêu cầu phi chức năng

| Nhóm | Yêu cầu | Cách kiểm chứng |
|------|---------|----------------|
| Kiến trúc | Tuân thủ SOLID; mẫu thiết kế được áp dụng có lý do; tách tầng miền, ứng dụng, hạ tầng; tiêm phụ thuộc xuyên suốt | Rà soát thiết kế (chương 4), luật phân lớp được kiểm tra tự động trên mã sinh ra |
| Kiểm thử | Tầng miền ≥ 90% hàm, dòng, lệnh và ≥ 85% nhánh; toàn API có ngưỡng sàn; kiểm thử đầu-cuối cho các hành trình chính | Ngưỡng `coverageThreshold` của Jest làm hỏng lệnh `test:cov` nếu không đạt; các lần chạy đầu-cuối có lưu vết |
| Hiệu năng | Mỗi nút quy trình ≤ 2 s (không tính độ trễ LLM); các đọc trên bảng điều khiển trong ngân sách p50/p95/p99 với 20 người dùng đồng thời, lỗi ≤ 1% | Đo bước quy trình (mục 6.4), kiểm thử tải có ngân sách (mục 6.5) |
| Bảo mật | Băm mật khẩu bcrypt; JWT có hạn (mặc định 8 giờ); tự đăng ký chỉ nhận quyền xem; khoá của nhà cung cấp LLM được mã hoá và không bao giờ trả về; khoá API chỉ mang phạm vi mà vai trò chủ sở hữu cho phép; nhật ký kiểm toán không lưu bí mật; webhook ký HMAC và chặn địa chỉ mạng nội bộ; sandbox cách ly; cấu hình production sai thì không khởi động | Kiểm thử đơn vị và đầu-cuối (mục 6.3) |
| Tin cậy | Thử lại có giãn cách mũ; khôi phục quy trình khi khởi động lại; kiểm tra sức khoẻ cho cân bằng tải | Kiểm thử bộ máy quy trình, kiểm thử sức khoẻ |
| Tài liệu | Đủ sơ đồ use case, lớp, tuần tự, hoạt động, máy trạng thái, thành phần và triển khai | 39 sơ đồ PlantUML được render tự động, lệnh render thất bại nếu có lỗi cú pháp |

## Mô hình use case

Nền tảng có 31 use case đã được đặc tả, chia thành bốn nhóm như trong bảng sau.

| Nhóm | Use case |
|------|----------|
| Quản lý dự án (con người) | UC-001 Xác thực · UC-002 Tạo dự án · UC-005 Duyệt bước quy trình · UC-006 Từ chối bước quy trình · UC-007 Theo dõi tiến độ · UC-008 Xem chi phí · UC-020 Quản lý Kanban · UC-022 Tạo báo cáo dự án · UC-026 Duyệt sản phẩm của dự án |
| Tác tử | UC-009 Phân tích yêu cầu (BA) · UC-010 Thiết kế kiến trúc (Architect) · UC-011 Lập kế hoạch (PM) · UC-012 Thực hiện công việc phát triển (DEV) · UC-013 Rà soát mã (QA) · UC-014 Chiến lược marketing · UC-015 Điều phối quy trình (CEO) · UC-016 Kiểm chứng hiện thực theo use case (QC) · UC-023 Phân tích chất lượng mã (DEV, QA) |
| Hệ thống | UC-004 Thực thi quy trình · UC-017 Quản lý bộ nhớ tác tử · UC-018 Định tuyến yêu cầu LLM · UC-019 Khôi phục quy trình · UC-021 Phòng họp tác tử · UC-024 Dự báo công sức và chi phí |
| Quản trị và tích hợp | UC-003 Cấu hình tác tử · UC-025 Theo dõi sức khoẻ hệ thống · UC-029 Quản lý người dùng và vai trò · UC-030 Xem nhật ký kiểm toán · UC-031 Quản lý khoá API và webhook · UC-032 Gọi API tích hợp · UC-033 Xem phân tích hiệu năng tác tử |

![Sơ đồ use case tổng thể của nền tảng](../diagrams/rendered/use-cases/overall-system.svg){.wide}

Các quan hệ giữa use case phản ánh cấu trúc của quy trình: UC-004 *Thực thi quy trình* `«include»` UC-005 *Duyệt bước* khi quy trình có nút chờ con người; UC-006 *Từ chối* `«extend»` UC-005; UC-012 *Phát triển* `«include»` UC-023 *Phân tích chất lượng mã* (dự đoán phán quyết QA và sửa một vòng); UC-016 của QC dùng kết quả của UC-009 (use case do BA viết) làm đầu vào.

## Đặc tả use case tiêu biểu

### UC-002 Tạo dự án

- **Tác nhân:** thành viên hội đồng quản trị.
- **Tiền điều kiện:** đã đăng nhập, có quyền `project:create`.
- **Luồng chính:** (1) người dùng chọn mẫu quy trình và điền tham số (ví dụ số use case tối thiểu, có bật bước duyệt của con người không); (2) hệ thống kiểm tra mẫu và tham số trước khi tạo bất cứ thứ gì; (3) thực thể `Project` được tạo qua phương thức nhà máy `Project.create`, áp dụng các bất biến (tên không rỗng, ngân sách dương); (4) dự án được lưu, sự kiện `ProjectCreatedEvent` được phát; (5) bộ máy quy trình tạo một lượt chạy gắn với phiên bản bất biến `mẫu@phiên_bản+băm` của định nghĩa quy trình; (6) một dự báo thời gian và chi phí được lưu khi quy trình bắt đầu.
- **Luồng thay thế:** nếu mẫu không tồn tại, hệ thống trả về mã 404; nếu tham số sai kiểu, hệ thống trả về mã 400 trước khi tạo dự án; nếu người xem gọi chức năng này, hệ thống trả về mã 403 và ghi một mục `access.denied` vào nhật ký kiểm toán.
- **Hậu điều kiện:** dự án ở trạng thái `active`, có một lượt chạy quy trình; nhật ký kiểm toán có `project.create` và `workflow.started`.

### UC-004 Thực thi quy trình

- **Tác nhân:** hệ thống (bộ máy quy trình) và các tác tử.
- **Luồng chính:** bộ máy lấy nút hiện tại, chọn chiến lược thực thi theo loại nút (`agent_task`, `sub_workflow`, `quality_gate`, `condition`, `parallel`, `human_approval`), ghi lại một bước (`WorkflowStep`) kèm thời lượng, gộp kết quả vào ngữ cảnh của lượt chạy, chụp ảnh trạng thái (Memento), chọn cạnh kế tiếp và lặp lại cho đến khi gặp nút kết thúc.
- **Luồng thay thế:** nút thất bại được thử lại tối đa ba lần với thời gian giãn cách tăng theo hàm mũ; nếu vẫn thất bại, lượt chạy đi theo cạnh `onFail` hoặc chuyển sang trạng thái `failed` và phát sự kiện `workflow.failed`; khi gặp nút chờ duyệt, lượt chạy chuyển sang trạng thái `paused`; khi chi phí vượt ngưỡng ngân sách, lượt chạy bị tạm dừng.

### UC-016 Kiểm chứng hiện thực theo use case (QC)

- **Tác nhân:** tác tử QC.
- **Luồng chính:** (1) QC đọc các use case do BA viết và mã nguồn do DEV viết; (2) QC viết một tệp kiểm thử Jest cho mỗi use case (`tests/UC-xxx.spec.ts`); (3) hệ thống chạy kiểm thử trong sandbox Docker, hoặc trong một bản sao tạm thời nếu được phép chạy cục bộ; (4) QC xây dựng ma trận truy vết từ use case đến lớp, tệp hiện thực, tệp kiểm thử và kết quả kiểm thử; (5) độ bao phủ use case được ghi vào siêu dữ liệu OOAD của dự án.
- **Hậu điều kiện:** độ bao phủ chỉ tính các kiểm thử đã chạy và đạt; kiểm thử mới được viết mà chưa chạy đạt thì không được tính. Use case chưa có kiểm thử được liệt kê là còn thiếu.

## Mô hình miền

Mô hình miền của nền tảng gồm ba aggregate chính và một số khái niệm hỗ trợ:

- **Project** (gốc aggregate) chứa các `Milestone` và `Task`; có ngân sách và chi phí tích luỹ được biểu diễn bằng value object `Money`; trạng thái `ProjectStatus` là một value object có máy trạng thái riêng.
- **Agent** có `AgentRole`, cấu hình mô hình, bộ nhớ (`AgentMemory`) và máy trạng thái vòng đời.
- **WorkflowRun** tham chiếu đến một phiên bản bất biến của định nghĩa quy trình, chứa các `WorkflowStep` và các ảnh chụp `WorkflowSnapshot`, có thể có lượt chạy cha (trường hợp quy trình con) và các `Approval`.

Các khái niệm hỗ trợ gồm `User` và `Role`, `AuditLog` (chỉ ghi thêm), `ApiKey`, `Webhook` và `WebhookDelivery`, `ApiUsageLog` (chi phí LLM), `QualityGateLog`, `ProjectEstimate`.

![Mô hình miền tổng quan](../diagrams/rendered/classes/domain-model-overview.svg){.wide}
