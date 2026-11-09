# Kết luận và hướng phát triển

## Kết luận

Luận văn đã xây dựng AI-CORP, một nền tảng đa tác tử dùng LLM mô phỏng một công ty phần mềm với tám vai trò (CEO, BA, Architect, PM, DEV, QC, QA, Marketing), và áp dụng phân tích và thiết kế hướng đối tượng ở ba cấp độ: kiến trúc của nền tảng, thiết kế của từng tác tử, và sản phẩm mà các tác tử tạo ra cho người dùng.

Về kiến trúc, nền tảng có tầng miền độc lập với framework; mỗi tác tử được xây dựng theo mẫu Template Method kết hợp hai Strategy; tác tử, công việc và dự án có máy trạng thái riêng; các mô-đun giao tiếp qua sự kiện miền; mọi phụ thuộc vào hạ tầng đi qua Repository hoặc cổng. Bộ máy quy trình hỗ trợ quy trình con, phiên bản bất biến, ảnh chụp và khôi phục, nhánh song song, phê duyệt của con người và ba mẫu cộng tác giữa các tác tử. Về sản phẩm, mỗi dự án lần lượt đi qua use case, mô hình miền, sơ đồ UML, mã nguồn phân lớp, kiểm thử chấp nhận và ma trận truy vết, với cổng chất lượng OOAD, phân tích tĩnh và một vòng tự sửa có giới hạn chi phí. Về vận hành, nền tảng có phân quyền theo vai trò, nhật ký kiểm toán, khoá API, webhook ký HMAC, xuất báo cáo, quản lý nhà cung cấp và mô hình LLM ngay trong ứng dụng, điều khiển lượt chạy có ràng buộc ngân sách, phân tích hiệu năng tác tử, dự báo thời gian và chi phí, cùng cấu hình triển khai Docker có kiểm tra cấu hình production và kiểm tra sức khoẻ.

Các kết quả chính đo được gồm:

- 707 kiểm thử API và 44 kiểm thử web đều đạt; tầng miền có độ bao phủ 97,1% số dòng và 88,1% số nhánh.
- Các lần chạy đầu-cuối trên hạ tầng thật đạt 24/24, 21/21 và 44/44 kiểm tra; cấu hình production dựng được lược đồ từ migration và lược đồ không sai lệch so với mô hình.
- Mọi nút quy trình được xử lý dưới 2 giây (p95 là 1,64 s, chưa trừ độ trễ LLM giả lập); một tiến trình API phục vụ khoảng 605 yêu cầu đọc mỗi giây với 20 người dùng và bão hoà ở khoảng 407 yêu cầu/giây với 50 người dùng, không phát sinh lỗi.
- Dự báo thời gian tác tử có MAPE leave-one-out từ 3% đến 30% tuỳ vai trò.
- Kiểm thử trên hạ tầng thật, một đợt rà soát giao diện và logic, cùng việc cài đặt mới đã phát hiện và sửa 50 lỗi, trong đó có lỗ hổng cho phép người xem phê duyệt qua WebSocket và lỗi cho phép một yêu cầu phê duyệt được trả lời hai lần.

Đối với ba câu hỏi nghiên cứu, luận văn rút ra các kết luận sau. Thứ nhất, OOAD cải thiện rõ rệt tính mô-đun, khả năng mở rộng và khả năng kiểm thử, với điều kiện có kiểm thử đầu-cuối chứng minh thiết kế thực sự được sử dụng. Thứ hai, Template Method kết hợp Strategy cho tác tử, Strategy tự đăng ký kết hợp Composite cho quy trình, và State gắn với đúng đối tượng có vòng đời là các mẫu hiệu quả nhất; nhìn chung, một mẫu thiết kế có giá trị nhất khi tạo ra một điểm kiểm soát duy nhất có tính nguyên tử. Thứ ba, việc học từ lịch sử để dự báo đo được và cho sai số chấp nhận được; còn việc học để cải thiện sản phẩm đã được hiện thực và kiểm chứng về mặt cơ chế, nhưng mức cải thiện chỉ có thể đo một cách khách quan khi dùng LLM thật trong một thí nghiệm có nhóm đối chứng.

## Hướng phát triển

1. **Đánh giá với LLM thật.** Trang quản lý nhà cung cấp đã cho phép chọn mô hình thật cho từng vai trò mà không phải sửa mã, nên trở ngại chính của bước này là chi phí và thời gian chạy. Hướng phát triển này gồm việc chạy lại tập dự án đánh giá với một hoặc nhiều mô hình thật qua cổng tương thích OpenAI; đo chất lượng sản phẩm (tỉ lệ đạt cổng OOAD ngay lần đầu, số lần QA từ chối, số kiểm thử chấp nhận đạt), thời gian và chi phí thực tế; và đánh giá lại mô hình dự báo cùng bộ dự đoán chất lượng mã trên dữ liệu thu được.
2. **Thí nghiệm có đối chứng cho cơ chế học**, theo thiết kế đã nêu ở mục 7.3: hai nhóm có học và không học, lặp lại nhiều lần, kèm kiểm định thống kê.
3. **Đánh giá thiết kế bởi chuyên gia**: mời chuyên gia chấm điểm sản phẩm OOAD của các dự án sinh ra theo một thang đo, nhằm kiểm tra mức độ tương quan giữa cổng chất lượng tự động và đánh giá của con người.
4. **Đưa sandbox container vào kiểm thử thường xuyên**: chạy các kiểm thử sandbox trên một máy CI có Docker và kiểm chứng đầu-cuối luồng thực thi mã trong container.
5. **Mở rộng ngang**: bổ sung adapter Redis cho Socket.IO, chạy nhiều bản sao API phía sau nginx và kiểm thử tải với cấu hình đó.
6. **Hỗ trợ ngôn ngữ đích khác**: tách bộ phân tích tĩnh và trình chạy kiểm thử thành các adapter theo từng ngôn ngữ, đặt sau cổng `ICodeAnalyzer` đã có, bắt đầu với Python hoặc Java.
7. **Tăng cường vai trò của con người trong vòng lặp**: cho phép người dùng sửa trực tiếp một sản phẩm (ví dụ mô hình miền) tại bước phê duyệt và để quy trình tiếp tục từ bản đã sửa, tận dụng cơ chế ảnh chụp và khôi phục sẵn có.
8. **Kiểm thử xâm nhập độc lập** cho API, WebSocket và webhook trước khi sử dụng với dữ liệu thật.
9. **Hoàn thiện cơ chế điều khiển chi phí và phiên làm việc**: huỷ các lời gọi LLM quá hạn, ước lượng chi phí trước mỗi lời gọi để không nút nào làm vượt ngân sách, cho phép giao lại yêu cầu phê duyệt, bổ sung nhánh riêng khi phê duyệt bị từ chối, và hỗ trợ token làm mới cho phiên đăng nhập.
