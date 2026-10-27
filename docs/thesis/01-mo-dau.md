# Mở đầu

## Bối cảnh

Một dự án phần mềm doanh nghiệp, dù nhỏ, đi qua nhiều công đoạn do nhiều vai trò đảm nhận. Người phân tích nghiệp vụ thu thập yêu cầu và viết đặc tả use case; kiến trúc sư xây dựng mô hình miền, chọn mẫu thiết kế và vẽ các sơ đồ UML; người quản lý dự án chia việc; lập trình viên hiện thực; người kiểm thử viết và chạy kiểm thử; người đảm bảo chất lượng rà soát xem sản phẩm có đúng thiết kế và quy trình hay không. Phân tích và thiết kế hướng đối tượng (Object-Oriented Analysis and Design, OOAD) cung cấp ngôn ngữ chung cho chuỗi này: use case mô tả hành vi hệ thống từ góc nhìn tác nhân [3], mô hình miền và sơ đồ lớp mô tả cấu trúc, sơ đồ tuần tự và trạng thái mô tả hành vi [1], [2], còn các mẫu thiết kế ghi lại lời giải đã được kiểm chứng cho các vấn đề lặp lại [4], [5].

Trên thực tế, chuỗi này hay đứt gãy ở hai chỗ. Thứ nhất, tài liệu thiết kế lệch dần khỏi mã nguồn vì không có gì buộc chúng phải khớp nhau. Thứ hai, chất lượng thường được khẳng định thay vì được đo: một use case "đã xong" nhưng không có kiểm thử nào chứng minh, một lớp "theo kiến trúc phân lớp" nhưng tầng miền lại phụ thuộc hạ tầng.

Các mô hình ngôn ngữ lớn (LLM) đã cho thấy khả năng sinh mã [22] và giải một phần các tác vụ kỹ nghệ phần mềm thực tế [23]. Các hệ đa tác tử dựa trên LLM như MetaGPT [24], ChatDev [25] hay AutoGen [26] mô phỏng một nhóm phát triển với nhiều vai trò, mỗi vai trò là một tác tử. Tuy nhiên, các hệ thống này chủ yếu đo sản phẩm cuối (mã có chạy không) và ít quan tâm đến hai câu hỏi mà một luận văn về OOAD phải trả lời: bản thân hệ thống có được thiết kế tốt theo nguyên lý hướng đối tượng không, và sản phẩm nó tạo ra có truy vết được từ yêu cầu đến kiểm thử không.

## Động lực và vấn đề nghiên cứu

Luận văn xuất phát từ một nền tảng đa tác tử ban đầu có năm tác tử (CEO, PM, DEV, QA, Marketing) và một bộ máy quy trình. Khi rà soát, nền tảng này có các vấn đề điển hình của một hệ thống phát triển nhanh: tầng miền được thiết kế nhưng không được dùng, lớp tác tử cơ sở gánh quá nhiều trách nhiệm, dịch vụ trộn logic nghiệp vụ với truy cập dữ liệu, không có kho lưu trữ (Repository) hay sự kiện miền, tài liệu UML thiếu, và sản phẩm do tác tử tạo ra bị mất sau mỗi lần chạy vì được ghi vào một sandbox không lưu trữ.

Từ đó, luận văn đặt ra ba câu hỏi nghiên cứu:

- **RQ1.** Áp dụng có hệ thống các nguyên lý OOAD (phân lớp, SOLID, mẫu thiết kế, thiết kế hướng miền) có cải thiện được kiến trúc của một hệ đa tác tử dùng LLM về tính mô-đun, khả năng mở rộng và khả năng kiểm thử không?
- **RQ2.** Những mẫu thiết kế nào hiệu quả nhất cho việc điều phối các tác tử và quy trình của chúng?
- **RQ3.** Các tác tử có thể học từ những lần thực thi trước để cải thiện kết quả như thế nào, và làm sao đo được điều đó một cách trung thực?

## Mục tiêu và phạm vi

Mục tiêu của luận văn là thiết kế và hiện thực một nền tảng đa tác tử mà:

1. Chính nó là một ví dụ mẫu về OOAD: có đặc tả use case, mô hình miền, đủ sáu góc nhìn UML, kiến trúc phân lớp, mẫu thiết kế được gắn với vấn đề cụ thể, và kiểm thử tự động đo được.
2. Mọi dự án nó tạo ra cũng tuân thủ OOAD và có truy vết từ use case đến kiểm thử.
3. Chất lượng được đo chứ không khẳng định: có cổng chất lượng, kiểm thử chấp nhận được thực thi, phân tích tĩnh, phân tích hiệu năng tác tử và dự báo được so với thực tế.
4. Có các tính năng cần cho môi trường doanh nghiệp: phân quyền, nhật ký kiểm toán, API tích hợp, xuất báo cáo và triển khai được.

Phạm vi được giới hạn có chủ đích:

- **Sản phẩm là dự án được phân tích, thiết kế, hiện thực và kiểm thử, không phải một bản triển khai đang chạy.** Vì vậy vai trò DevOps của nền tảng ban đầu bị loại bỏ (không có đầu ra kiểm chứng được và kéo phạm vi sang CI/CD), trong khi vai trò kiểm soát chất lượng (QC) được thêm vào và vai trò đảm bảo chất lượng (QA) được định nghĩa lại theo nghĩa quy trình (mục 3.1).
- **Dự án sinh ra viết bằng TypeScript** để nền tảng có thể tự phân tích tĩnh và chạy kiểm thử của chúng.
- **Các phép đo dùng một LLM kịch bản** (một máy chủ tương thích OpenAI trả lời theo kịch bản) để mọi kết quả lặp lại được. Nền tảng làm việc với bất kỳ cổng LLM tương thích OpenAI nào; đánh giá chất lượng đầu ra với LLM thật nằm ngoài phạm vi đo của luận văn và được nêu trong phần giới hạn.

## Đóng góp

1. **Một kiến trúc tham chiếu cho hệ đa tác tử dùng LLM theo OOAD**: tầng miền độc lập framework (101 tệp), tác tử là Template Method cộng hai Strategy, máy trạng thái cho tác tử, công việc và quy trình, sự kiện miền cho giao tiếp giữa các mô-đun, Repository và cổng (port) cho mọi phụ thuộc hạ tầng.
2. **OOAD áp dụng cho sản phẩm của tác tử**: chuỗi use case → mô hình miền → UML → mã phân lớp → kiểm thử chấp nhận → ma trận truy vết, với cổng chất lượng OOAD, phân tích tĩnh có kiểm tra vi phạm phân lớp và một vòng tự sửa có giới hạn chi phí.
3. **Bộ máy quy trình có quy trình con (Composite), phiên bản bất biến, ảnh chụp và khôi phục (Memento), nhánh song song có phụ thuộc** và các mẫu quy trình có kiểu.
4. **Đánh giá trung thực**: phân tích hiệu năng tác tử theo tiêu chí riêng của từng vai trò, mô hình dự báo đánh giá bằng sai số leave-one-out, dự đoán phán quyết QA được so với phán quyết thật, cùng các lần chạy đầu-cuối có lưu vết.

## Phương pháp nghiên cứu

Luận văn theo phương pháp nghiên cứu khoa học thiết kế (design science) [45]: xây dựng một tạo tác (nền tảng), đánh giá nó bằng các phép đo lặp lại được, và rút ra tri thức thiết kế. Việc phát triển đi theo vòng lặp: rà soát hiện trạng, phân tích yêu cầu thành use case, thiết kế, hiện thực theo hướng kiểm thử trước (TDD) [34], chạy kiểm thử đầu-cuối trên hạ tầng thật (PostgreSQL, Redis, nginx), và ghi lại mọi lỗi phát hiện được cùng cách sửa. Mỗi số liệu trong luận văn có nguồn trong kho mã (tệp kết quả hoặc lệnh để tái tạo).

## Cấu trúc luận văn

Chương 2 trình bày cơ sở lý thuyết về OOAD, hệ đa tác tử, điều phối quy trình và ứng dụng AI trong kỹ nghệ phần mềm. Chương 3 phân tích yêu cầu và mô hình use case. Chương 4 trình bày thiết kế: kiến trúc, mẫu thiết kế, tác tử, bộ máy quy trình và cách nền tảng áp dụng OOAD cho dự án sinh ra. Chương 5 mô tả hiện thực. Chương 6 trình bày kiểm thử và đánh giá. Chương 7 thảo luận câu trả lời cho các câu hỏi nghiên cứu và các giới hạn. Chương 8 kết luận và nêu hướng phát triển. Các phụ lục gồm danh mục sơ đồ UML, tài liệu API, số liệu kiểm thử, số liệu hiệu năng và hướng dẫn sử dụng.
