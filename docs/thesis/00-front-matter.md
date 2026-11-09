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

*[Sinh viên tự viết và ký: cam đoan luận văn là kết quả nghiên cứu của bản thân dưới sự hướng dẫn của giảng viên hướng dẫn; các số liệu trong luận văn là trung thực và có nguồn gốc rõ ràng.]*

# Lời cảm ơn {.unnumbered}

*[Sinh viên tự viết.]*

# Tóm tắt {.unnumbered}

Một dự án phần mềm cần nhiều vai trò phối hợp với nhau: phân tích nghiệp vụ, thiết kế kiến trúc, lập kế hoạch, lập trình, kiểm thử và kiểm soát chất lượng. Khi các công đoạn này được thực hiện thủ công, tài liệu phân tích và thiết kế hướng đối tượng (OOAD) thường lệch dần khỏi mã nguồn, và chất lượng sản phẩm thường chỉ được khẳng định mà không được đo. Những năm gần đây, các hệ đa tác tử dựa trên mô hình ngôn ngữ lớn (LLM) đã tự động hoá được một phần chuỗi công việc này. Tuy vậy, bản thân các hệ thống đó hiếm khi được thiết kế theo OOAD, và sản phẩm chúng tạo ra hiếm khi truy vết được từ yêu cầu đến kiểm thử.

Luận văn trình bày AI-CORP, một nền tảng gồm tám tác tử (CEO, BA, Architect, PM, DEV, QC, QA, Marketing) được điều phối bởi một bộ máy quy trình (workflow engine) theo đồ thị có hướng không chu trình. Nền tảng được thiết kế theo kiến trúc phân lớp và thiết kế hướng miền (DDD). Tầng miền độc lập với framework. Mỗi tác tử là một lớp con của `BaseAgent` (mẫu Template Method), kết hợp với hai chiến lược tư duy và hành động được tiêm vào (mẫu Strategy). Vòng đời của tác tử, công việc và quy trình được mô hình hoá bằng máy trạng thái, còn các thành phần giao tiếp với nhau qua sự kiện miền (mẫu Observer). Điểm khác biệt của luận văn là OOAD được áp dụng ở hai mức: cho chính nền tảng và cho mọi dự án do nền tảng sinh ra. Mỗi dự án lần lượt đi qua use case, mô hình miền, sơ đồ UML, mã nguồn phân lớp, kiểm thử chấp nhận theo use case và ma trận truy vết. Sau bước thiết kế có một cổng chất lượng OOAD; mã sinh ra được phân tích tĩnh bằng TypeScript compiler API và được sửa tối đa một vòng trước khi QA duyệt.

Ngoài ra, nền tảng có các tính năng cần cho môi trường doanh nghiệp: phân quyền theo vai trò và theo quyền sở hữu dự án, nhật ký kiểm toán chỉ cho phép ghi thêm, API tích hợp xác thực bằng khoá API, webhook ký HMAC, xuất báo cáo dạng PDF, CSV và JSON, quản lý nhà cung cấp và mô hình LLM với khoá được mã hoá, và điều khiển lượt chạy trong giới hạn ngân sách. Nền tảng cũng phân tích hiệu năng của từng tác tử theo vai trò, cảnh báo khi có bất thường, và dùng mô hình hồi quy ridge để dự báo thời gian và chi phí LLM của từng vai trò; sai số dự báo được đánh giá bằng phương pháp leave-one-out.

Về kết quả, 707 kiểm thử tự động trong 50 bộ kiểm thử đều đạt. Tầng miền đạt độ bao phủ 97,1% số dòng và 88,1% số nhánh. Ba lần chạy đầu-cuối trên PostgreSQL, Redis và nginx lần lượt đạt 24/24, 21/21 và 44/44 kiểm tra. Thời gian xử lý một nút quy trình, không tính độ trễ của LLM, có trung vị 110 ms và phân vị 99 là 1,73 s. Với 20 người dùng đồng thời, một tiến trình API phục vụ được 604,8 yêu cầu/giây mà không phát sinh lỗi. Quá trình kiểm thử, một đợt rà soát mã phần giao diện và logic, cùng việc cài đặt lại từ đầu đã phát hiện và sửa 50 lỗi, trong đó có một lỗ hổng cho phép người dùng chỉ có quyền xem phê duyệt quy trình qua WebSocket. Hạn chế chính của luận văn là các phép đo dùng một LLM kịch bản để kết quả lặp lại được; vì vậy chất lượng đầu ra khi dùng LLM thật và mức cải thiện nhờ cơ chế học của tác tử chưa được đo định lượng.

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
