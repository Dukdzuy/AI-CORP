# Kết luận và hướng phát triển

## Kết luận

Luận văn đã xây dựng AI Corp, một nền tảng đa tác tử dùng LLM mô phỏng một công ty phần mềm với tám vai trò (CEO, BA, Architect, PM, DEV, QC, QA, Marketing), và áp dụng phân tích và thiết kế hướng đối tượng ở ba cấp: kiến trúc của nền tảng, thiết kế của từng tác tử, và sản phẩm mà các tác tử tạo ra cho người dùng.

Về kiến trúc, nền tảng có tầng miền độc lập framework, tác tử là Template Method cùng hai Strategy, máy trạng thái cho tác tử, công việc và dự án, sự kiện miền cho giao tiếp giữa các mô-đun, và Repository cùng cổng cho mọi phụ thuộc hạ tầng. Bộ máy quy trình hỗ trợ quy trình con, phiên bản bất biến, ảnh chụp và khôi phục, nhánh song song, phê duyệt của con người và ba mẫu cộng tác giữa tác tử. Về sản phẩm, mỗi dự án đi qua chuỗi use case → mô hình miền → UML → mã phân lớp → kiểm thử chấp nhận → ma trận truy vết, với cổng chất lượng OOAD, phân tích tĩnh và một vòng tự sửa có giới hạn chi phí. Về vận hành, nền tảng có phân quyền theo vai trò, nhật ký kiểm toán, khoá API, webhook ký HMAC, xuất báo cáo, phân tích hiệu năng tác tử, dự báo thời gian và chi phí, cùng cấu hình triển khai Docker có kiểm tra cấu hình production và kiểm tra sức khoẻ.

Các kết quả chính đo được:

- 674 kiểm thử API và 41 kiểm thử web đạt; tầng miền có độ bao phủ 97,1% dòng và 89,6% nhánh.
- Các lần chạy đầu-cuối trên hạ tầng thật đạt 21/21, 21/21 và 44/44 kiểm tra; cấu hình production dựng được lược đồ từ migration không lệch so với mô hình.
- Mọi nút quy trình xử lý dưới 2 giây (p95 1,69 s, chưa trừ độ trễ LLM giả lập); một tiến trình API phục vụ khoảng 200 yêu cầu/giây chỉ đọc và 178 yêu cầu/giây khi bão hoà, không có lỗi.
- Dự báo thời gian tác tử có MAPE leave-one-out từ 3% đến 30% tuỳ vai trò.
- Kiểm thử trên hạ tầng thật phát hiện và sửa 32 lỗi, trong đó có một lỗ hổng cho phép người xem phê duyệt qua WebSocket.

Với ba câu hỏi nghiên cứu, luận văn kết luận: (1) OOAD cải thiện rõ tính mô-đun, khả năng mở rộng và khả năng kiểm thử, với điều kiện có kiểm thử đầu-cuối chứng minh thiết kế thực sự được dùng; (2) Template Method kết hợp Strategy cho tác tử, Strategy tự đăng ký kết hợp Composite cho quy trình, và State gắn đúng đối tượng có vòng đời là các mẫu hiệu quả nhất, và nhìn chung mẫu có giá trị nhất khi tạo ra một điểm kiểm soát duy nhất; (3) học từ lịch sử để dự báo đo được và cho sai số chấp nhận được, còn học để cải thiện sản phẩm đã được hiện thực và kiểm chứng về cơ chế, nhưng mức cải thiện chỉ có thể đo trung thực với LLM thật trong một thí nghiệm có nhóm đối chứng.

## Hướng phát triển

1. **Đánh giá với LLM thật.** Chạy lại tập dự án đánh giá với một hoặc nhiều mô hình thật qua cổng tương thích OpenAI, đo chất lượng sản phẩm (tỉ lệ đạt cổng OOAD lần đầu, số lần QA từ chối, kiểm thử chấp nhận đạt), thời gian và chi phí thực, và đánh giá lại mô hình dự báo và bộ dự đoán chất lượng mã trên dữ liệu đó.
2. **Thí nghiệm có đối chứng cho cơ chế học**, theo thiết kế ở mục 7.3: hai nhóm có học và không học, nhiều lần lặp, kiểm định thống kê.
3. **Đánh giá thiết kế bởi chuyên gia**: cho chuyên gia chấm sản phẩm OOAD của các dự án sinh ra theo một thang đo, để kiểm tra xem cổng chất lượng tự động có tương quan với đánh giá của con người không.
4. **Sandbox container trong kiểm thử thường xuyên**: chạy các kiểm thử sandbox trên một máy chạy CI có Docker, và kiểm chứng đầu-cuối đường chạy mã trong container.
5. **Mở rộng ngang**: thêm bộ chuyển Redis cho Socket.IO, chạy nhiều bản sao API sau nginx, và kiểm thử tải ở cấu hình đó.
6. **Ngôn ngữ đích khác**: tách bộ phân tích tĩnh và trình chạy kiểm thử thành các adapter theo ngôn ngữ sau cổng `ICodeAnalyzer` đã có, bắt đầu với Python hoặc Java.
7. **Con người trong vòng lặp sâu hơn**: cho phép người dùng sửa trực tiếp một sản phẩm (ví dụ mô hình miền) tại bước phê duyệt và để quy trình tiếp tục từ bản đã sửa, tận dụng cơ chế ảnh chụp và khôi phục.
8. **Kiểm thử xâm nhập độc lập** cho API, WebSocket và webhook trước khi dùng với dữ liệu thật.
