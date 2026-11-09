# Mở đầu

## Bối cảnh

Một dự án phần mềm doanh nghiệp, dù có quy mô nhỏ, cũng phải đi qua nhiều công đoạn do nhiều vai trò khác nhau đảm nhận. Người phân tích nghiệp vụ thu thập yêu cầu và viết đặc tả use case. Kiến trúc sư xây dựng mô hình miền, lựa chọn mẫu thiết kế và vẽ các sơ đồ UML. Người quản lý dự án phân chia công việc, lập trình viên hiện thực, người kiểm thử viết và chạy các ca kiểm thử, còn người đảm bảo chất lượng rà soát xem sản phẩm có tuân theo thiết kế và quy trình hay không. Phân tích và thiết kế hướng đối tượng (Object-Oriented Analysis and Design, OOAD) cung cấp một ngôn ngữ chung cho toàn bộ chuỗi công việc này: use case mô tả hành vi của hệ thống từ góc nhìn của tác nhân [3]; mô hình miền và sơ đồ lớp mô tả cấu trúc; sơ đồ tuần tự và sơ đồ trạng thái mô tả hành vi [1], [2]; các mẫu thiết kế ghi lại những lời giải đã được kiểm chứng cho các vấn đề thường gặp [4], [5].

Trong thực tế, chuỗi công việc trên thường đứt gãy ở hai điểm. Thứ nhất, tài liệu thiết kế lệch dần khỏi mã nguồn vì không có cơ chế nào buộc hai bên phải khớp nhau. Thứ hai, chất lượng thường chỉ được khẳng định mà không được đo: một use case được báo là "đã xong" nhưng không có kiểm thử nào chứng minh, hoặc một lớp được cho là "tuân theo kiến trúc phân lớp" nhưng tầng miền lại phụ thuộc vào tầng hạ tầng.

Các mô hình ngôn ngữ lớn (LLM) đã cho thấy khả năng sinh mã nguồn [22] và giải quyết được một phần các tác vụ kỹ nghệ phần mềm thực tế [23]. Các hệ đa tác tử dựa trên LLM như MetaGPT [24], ChatDev [25] hay AutoGen [26] mô phỏng một nhóm phát triển phần mềm, trong đó mỗi vai trò là một tác tử. Tuy nhiên, các hệ thống này chủ yếu đánh giá sản phẩm cuối cùng (mã nguồn có chạy được hay không) và ít quan tâm đến hai câu hỏi mà một luận văn về OOAD cần trả lời: bản thân hệ thống có được thiết kế tốt theo các nguyên lý hướng đối tượng hay không, và sản phẩm do hệ thống tạo ra có truy vết được từ yêu cầu đến kiểm thử hay không.

## Động lực và vấn đề nghiên cứu

Luận văn được xây dựng từ một nền tảng đa tác tử ban đầu gồm năm tác tử (CEO, PM, DEV, QA, Marketing) và một bộ máy quy trình. Qua rà soát, nền tảng này bộc lộ những vấn đề thường gặp ở các hệ thống được phát triển nhanh: tầng miền đã được thiết kế nhưng không được sử dụng; lớp tác tử cơ sở đảm nhận quá nhiều trách nhiệm; các dịch vụ trộn lẫn logic nghiệp vụ với truy cập dữ liệu; hệ thống không có kho lưu trữ (Repository) hay sự kiện miền; tài liệu UML còn thiếu; và sản phẩm do tác tử tạo ra bị mất sau mỗi lần chạy vì được ghi vào một sandbox không lưu trữ lâu dài.

Xuất phát từ thực trạng đó, luận văn đặt ra ba câu hỏi nghiên cứu:

- **RQ1.** Việc áp dụng có hệ thống các nguyên lý OOAD (kiến trúc phân lớp, SOLID, mẫu thiết kế, thiết kế hướng miền) có cải thiện được kiến trúc của một hệ đa tác tử dùng LLM về tính mô-đun, khả năng mở rộng và khả năng kiểm thử hay không?
- **RQ2.** Những mẫu thiết kế nào phù hợp nhất cho việc điều phối các tác tử và quy trình làm việc của chúng?
- **RQ3.** Các tác tử có thể học từ những lần thực thi trước để cải thiện kết quả theo cách nào, và làm thế nào để đo lường điều đó một cách khách quan?

## Mục tiêu và phạm vi

Mục tiêu của luận văn là thiết kế và hiện thực một nền tảng đa tác tử đáp ứng các yêu cầu sau:

1. Bản thân nền tảng là một ví dụ mẫu về OOAD: có đặc tả use case, mô hình miền, đủ sáu loại sơ đồ UML, kiến trúc phân lớp, các mẫu thiết kế gắn với vấn đề cụ thể và bộ kiểm thử tự động có số đo.
2. Mọi dự án do nền tảng tạo ra cũng tuân thủ OOAD và truy vết được từ use case đến kiểm thử.
3. Chất lượng được đo lường thay vì chỉ được khẳng định, thông qua cổng chất lượng, kiểm thử chấp nhận được thực thi thật, phân tích tĩnh, phân tích hiệu năng tác tử và so sánh dự báo với thực tế.
4. Nền tảng có các tính năng cần thiết cho môi trường doanh nghiệp: phân quyền, nhật ký kiểm toán, API tích hợp, xuất báo cáo và khả năng triển khai.

Phạm vi của luận văn được giới hạn như sau:

- Sản phẩm của nền tảng là một dự án đã được phân tích, thiết kế, hiện thực và kiểm thử; việc triển khai và vận hành dự án đó không thuộc phạm vi. Do vậy, vai trò DevOps của nền tảng ban đầu được loại bỏ, vì vai trò này không tạo ra đầu ra kiểm chứng được và kéo phạm vi sang CI/CD. Thay vào đó, vai trò kiểm soát chất lượng (QC) được bổ sung, và vai trò đảm bảo chất lượng (QA) được định nghĩa lại theo hướng kiểm soát quy trình (mục 3.1).
- Các dự án sinh ra được viết bằng TypeScript để nền tảng có thể tự phân tích tĩnh và chạy kiểm thử của chúng.
- Các phép đo sử dụng một LLM kịch bản, tức một máy chủ tương thích OpenAI trả lời theo kịch bản định sẵn, để mọi kết quả đều lặp lại được. Nền tảng hoạt động được với bất kỳ cổng LLM tương thích OpenAI nào; việc đánh giá chất lượng đầu ra khi dùng LLM thật nằm ngoài phạm vi đo của luận văn và được trình bày trong phần hạn chế.

## Đóng góp

Luận văn có bốn đóng góp chính:

1. Một kiến trúc tham chiếu cho hệ đa tác tử dùng LLM theo OOAD. Tầng miền (106 tệp) độc lập với framework; mỗi tác tử được xây dựng theo mẫu Template Method kết hợp hai Strategy; tác tử, công việc và quy trình đều có máy trạng thái riêng; các mô-đun giao tiếp qua sự kiện miền; mọi phụ thuộc vào hạ tầng đi qua Repository hoặc cổng (port).
2. Việc áp dụng OOAD cho chính sản phẩm của các tác tử, theo chuỗi từ use case, mô hình miền, sơ đồ UML, mã nguồn phân lớp, kiểm thử chấp nhận đến ma trận truy vết. Chuỗi này được kiểm soát bằng cổng chất lượng OOAD, phân tích tĩnh có phát hiện vi phạm phân lớp, và một vòng tự sửa lỗi có giới hạn chi phí.
3. Một bộ máy quy trình hỗ trợ quy trình con (mẫu Composite), phiên bản bất biến, ảnh chụp và khôi phục trạng thái (mẫu Memento), nhánh song song có ràng buộc phụ thuộc, cùng các mẫu quy trình có kiểu.
4. Một phương pháp đánh giá dựa trên số đo: hiệu năng tác tử được phân tích theo tiêu chí riêng của từng vai trò, mô hình dự báo được đánh giá bằng sai số leave-one-out, phán quyết QA dự đoán được so sánh với phán quyết thực tế, và các lần chạy đầu-cuối đều được lưu vết.

## Phương pháp nghiên cứu

Luận văn sử dụng phương pháp nghiên cứu khoa học thiết kế (design science) [45], gồm ba bước: xây dựng một tạo tác (ở đây là nền tảng), đánh giá tạo tác đó bằng các phép đo lặp lại được, và rút ra tri thức thiết kế. Quá trình phát triển được thực hiện theo vòng lặp: rà soát hiện trạng, phân tích yêu cầu thành các use case, thiết kế, hiện thực theo hướng kiểm thử trước (TDD) [34], chạy kiểm thử đầu-cuối trên hạ tầng thật (PostgreSQL, Redis, nginx), rà soát mã có hệ thống đối với phần giao diện và logic, và ghi nhận mọi lỗi phát hiện được cùng cách khắc phục. Mỗi số liệu trong luận văn đều có nguồn trong kho mã, dưới dạng tệp kết quả hoặc lệnh để tái tạo.

## Cấu trúc luận văn

Ngoài phần mở đầu, luận văn gồm bảy chương và phần phụ lục. Chương 2 trình bày cơ sở lý thuyết về OOAD, hệ đa tác tử, điều phối quy trình và ứng dụng AI trong kỹ nghệ phần mềm. Chương 3 phân tích yêu cầu và xây dựng mô hình use case. Chương 4 trình bày thiết kế hệ thống, bao gồm kiến trúc, các mẫu thiết kế, thiết kế tác tử, bộ máy quy trình và cách nền tảng áp dụng OOAD cho các dự án sinh ra. Chương 5 mô tả quá trình hiện thực. Chương 6 trình bày kiểm thử và đánh giá. Chương 7 thảo luận câu trả lời cho các câu hỏi nghiên cứu và các hạn chế. Chương 8 kết luận và nêu hướng phát triển. Phần phụ lục gồm danh mục sơ đồ UML, tài liệu API, số liệu kiểm thử, số liệu hiệu năng và hướng dẫn sử dụng.
