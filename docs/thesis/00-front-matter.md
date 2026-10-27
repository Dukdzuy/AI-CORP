<div class="cover">

<p class="cover-school">[TÊN TRƯỜNG]<br>[TÊN KHOA]</p>

<p class="cover-kind">LUẬN VĂN TỐT NGHIỆP</p>

<h1 class="cover-title">Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation</h1>

<p class="cover-subtitle">(Thiết kế và phát triển nền tảng đa tác tử tự động hoá quy trình doanh nghiệp theo hướng đối tượng)</p>

<table class="cover-meta">
<tr><td>Sinh viên thực hiện</td><td>[Họ và tên] – [MSSV]</td></tr>
<tr><td>Giảng viên hướng dẫn</td><td>[Học hàm, học vị, họ và tên]</td></tr>
<tr><td>Ngành</td><td>[Tên ngành]</td></tr>
</table>

<p class="cover-date">[Thành phố], tháng 12 năm 2026</p>

</div>

# Lời cam đoan {.unnumbered}

*[Sinh viên tự viết và ký: cam đoan luận văn là kết quả nghiên cứu của bản thân dưới sự hướng dẫn của giảng viên, các số liệu là trung thực và có nguồn gốc rõ ràng.]*

# Lời cảm ơn {.unnumbered}

*[Sinh viên tự viết.]*

# Tóm tắt {.unnumbered}

Phát triển một dự án phần mềm cần nhiều vai trò phối hợp: phân tích nghiệp vụ, thiết kế kiến trúc, lập kế hoạch, lập trình, kiểm thử và kiểm soát chất lượng. Khi làm thủ công, tài liệu phân tích và thiết kế hướng đối tượng (OOAD) thường lệch khỏi mã nguồn, còn chất lượng được khẳng định thay vì được đo. Các hệ thống đa tác tử dùng mô hình ngôn ngữ lớn (LLM) gần đây tự động hoá được một phần chuỗi này, nhưng bản thân chúng hiếm khi được thiết kế theo OOAD và sản phẩm của chúng hiếm khi có truy vết từ yêu cầu đến kiểm thử.

Luận văn trình bày AI-CORP, một nền tảng đa tác tử gồm tám tác tử (CEO, BA, Architect, PM, DEV, QC, QA, Marketing) do một bộ máy quy trình (workflow engine) điều phối theo đồ thị có hướng không chu trình. Nền tảng được thiết kế theo kiến trúc phân lớp và thiết kế hướng miền (DDD): tầng miền độc lập framework, các tác tử là một lớp `BaseAgent` (Template Method) kết hợp hai chiến lược tư duy và hành động được tiêm vào (Strategy), vòng đời tác tử, công việc và quy trình là các máy trạng thái, các thành phần giao tiếp qua sự kiện miền (Observer). Điểm khác biệt là OOAD được áp dụng hai lần: cho chính nền tảng, và cho mọi dự án nền tảng sinh ra. Mỗi dự án đi qua chuỗi use case → mô hình miền → sơ đồ UML → mã phân lớp → kiểm thử chấp nhận theo use case → ma trận truy vết, với một cổng chất lượng OOAD sau thiết kế, phân tích tĩnh mã sinh ra bằng TypeScript compiler API và một vòng sửa lỗi có giới hạn trước khi QA duyệt.

Nền tảng còn có các tính năng doanh nghiệp (phân quyền theo vai trò và quyền sở hữu dự án, nhật ký kiểm toán chỉ ghi thêm, API tích hợp bằng khoá API, webhook ký HMAC, xuất báo cáo PDF/CSV/JSON), phân tích hiệu năng tác tử theo vai trò với cảnh báo bất thường, và mô hình hồi quy ridge dự báo thời gian và chi phí LLM của từng vai trò, được đánh giá bằng sai số leave-one-out.

Kết quả đánh giá: 674 kiểm thử tự động đạt trong 47 bộ; tầng miền đạt độ bao phủ 97,1% số dòng và 89,6% số nhánh; các lần chạy đầu-cuối trên PostgreSQL, Redis và nginx đạt 21/21, 21/21 và 44/44 kiểm tra; chi phí xử lý một nút quy trình (không tính độ trễ LLM) có trung vị 108 ms và phân vị 99 là 1,73 s; với 20 người dùng đồng thời API phục vụ 201,8 yêu cầu/giây, không lỗi. Kiểm thử đã phát hiện và sửa các lỗi thật, trong đó có một lỗ hổng cho phép người dùng chỉ có quyền xem duyệt quy trình qua WebSocket. Luận văn cũng nêu rõ giới hạn: các phép đo dùng một LLM kịch bản để lặp lại được, nên chất lượng đầu ra với LLM thật và mức cải thiện nhờ cơ chế học của tác tử chưa được đo định lượng.

**Từ khoá:** phân tích và thiết kế hướng đối tượng, hệ đa tác tử, mô hình ngôn ngữ lớn, tự động hoá quy trình, mẫu thiết kế, truy vết yêu cầu.

# Danh mục từ viết tắt {.unnumbered}

| Viết tắt | Nghĩa |
|----------|-------|
| ACL | Agent Communication Language |
| ADR | Architecture Decision Record (bản ghi quyết định kiến trúc) |
| API | Application Programming Interface |
| BA | Business Analyst (tác tử phân tích nghiệp vụ) |
| BDI | Belief–Desire–Intention |
| BPMN | Business Process Model and Notation |
| CQRS | Command Query Responsibility Segregation |
| DAG | Directed Acyclic Graph (đồ thị có hướng không chu trình) |
| DDD | Domain-Driven Design (thiết kế hướng miền) |
| DI | Dependency Injection |
| E2E | End-to-end (đầu-cuối) |
| FR / NFR | Functional / Non-functional Requirement |
| GoF | Gang of Four (Gamma, Helm, Johnson, Vlissides) |
| HMAC | Hash-based Message Authentication Code |
| JWT | JSON Web Token |
| LLM | Large Language Model (mô hình ngôn ngữ lớn) |
| LOO | Leave-one-out (kiểm định chéo bỏ một) |
| MAPE / MAE | Mean Absolute Percentage Error / Mean Absolute Error |
| MAS | Multi-Agent System (hệ đa tác tử) |
| OCP | Open/Closed Principle |
| OOAD | Object-Oriented Analysis and Design |
| QA / QC | Quality Assurance / Quality Control |
| RBAC | Role-Based Access Control |
| SOLID | SRP, OCP, LSP, ISP, DIP |
| SPA | Single-Page Application |
| UC | Use case |
| UML | Unified Modeling Language |
