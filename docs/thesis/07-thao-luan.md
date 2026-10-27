# Thảo luận

Chương này trả lời ba câu hỏi nghiên cứu nêu ở chương 1 dựa trên kết quả của chương 6, sau đó phân tích các mối đe doạ đến tính hợp lệ của đánh giá và các giới hạn của nền tảng.

## RQ1: OOAD có cải thiện kiến trúc của hệ đa tác tử dùng LLM không?

Câu trả lời là có, với một điều kiện quan trọng được nêu ở cuối mục này. Bằng chứng được xét theo ba thuộc tính.

**Tính mô-đun.** Tầng miền gồm 101 tệp (6 893 dòng) không nhập NestJS, Prisma hay thư viện LLM nào; mọi phụ thuộc hạ tầng đi qua giao diện Repository hoặc cổng (port) như `ICodeAnalyzer`. Các mô-đun giao tiếp bằng sự kiện miền qua `EventBus`, nên kiểm toán, webhook và phân tích hiệu năng được thêm vào mà không sửa nơi phát sự kiện. Trong quá trình phát triển, nhiều thay đổi lớn chỉ chạm một chỗ: ghi chi phí cho cả tám vai trò được giải quyết bằng một Decorator quanh nhà cung cấp LLM; đóng lỗ hổng phê duyệt qua WebSocket là xoá một đường ghi và chuyển giao diện sang REST, phần kiểm quyền và kiểm toán không đổi.

**Khả năng mở rộng.** Thêm một vai trò tác tử gồm một giá trị `AgentRole`, một `RoleProfile`, hai lớp chiến lược và một dòng đăng ký nhà cung cấp; `AgentOrchestrator` và `WorkflowEngine` không đổi (mục 5.3). Thêm một loại nút quy trình là thêm một `NodeExecutionStrategy` tự đăng ký; quy trình con, cổng chất lượng, phê duyệt và ba mẫu cộng tác đều được thêm theo cách này. Thêm một định dạng xuất, một quy tắc bất thường hay một tín hiệu chất lượng cũng là thêm một lớp vào sổ đăng ký.

**Khả năng kiểm thử.** Vì miền độc lập framework, các quy tắc nghiệp vụ được kiểm thử bằng hàm thuần, không giả lập, và tầng miền đạt 97,1% dòng và 89,6% nhánh (mục 6.2). Chiến lược tác tử được kiểm thử với LLM và sandbox giả lập qua giao diện; bộ máy quy trình chạy được cả có và không có Redis. Toàn API có độ bao phủ thấp hơn (77,0% dòng) do phần nối framework, và đây là phân bố hợp lý: phần chứa quyết định được kiểm thử kỹ nhất.

**Điều kiện.** Cấu trúc OOAD tốt trong mã không bảo đảm thiết kế được dùng. Mục 6.9 cho thấy sáu lỗi thuộc nhóm "thiết kế OOAD không được dùng": bốn trên tám tác tử vẫn chạy luồng cũ nên các lớp chiến lược của chúng là mã chết, cổng chất lượng được viết nhưng không được đăng ký vào bộ máy, sản phẩm của tác tử bị mất sau mỗi lệnh sandbox. Mọi kiểm thử đơn vị của các lớp này đều đạt. Chỉ kiểm thử đầu-cuối trên hạ tầng thật, kiểm tra kết quả nhìn thấy được (tệp trên đĩa, mục kiểm toán, trạng thái lượt chạy) mới phát hiện ra. Kết luận rút ra là OOAD cải thiện kiến trúc khi đi kèm kiểm thử chứng minh từng đường thiết kế thực sự được thực thi, chẳng hạn kiểm tra rằng mỗi vai trò đều đi qua `BaseAgent.execute()` và mỗi chiến lược đăng ký đều được gọi.

## RQ2: Những mẫu thiết kế nào hiệu quả nhất cho việc điều phối?

Mức độ hiệu quả ở đây được đánh giá bằng tiêu chí thực dụng: mẫu nào giữ cho thay đổi cục bộ và mẫu nào giúp tìm ra hoặc ngăn lỗi trong quá trình phát triển.

1. **Template Method kết hợp Strategy cho tác tử** là mẫu có giá trị nhất. Chu trình chung (sự kiện, chuyển trạng thái, bộ nhớ, xử lý lỗi) nằm ở một nơi, còn chuyên môn của từng vai trò nằm trong hai chiến lược thay được độc lập. Khi phát hiện bốn tác tử chạy luồng cũ, việc sửa là đưa chúng về cùng khung, và mọi tính năng gắn với khung (ghi chi phí, học, sự kiện) tự động có hiệu lực cho cả bốn.
2. **Strategy tự đăng ký cho nút quy trình**, cùng **Composite** cho quy trình con, cho phép bộ máy quy trình phát triển từ chuỗi tuyến tính thành đồ thị có nhánh song song, quy trình con, phê duyệt và cộng tác mà không sửa vòng lặp thực thi.
3. **State**, với một bài học về phạm vi: máy trạng thái phải gắn với đối tượng thực sự có vòng đời. Gắn một máy trạng thái cho mỗi vai trò làm hai công việc đồng thời phá nhau; gắn cho mỗi lần thực thi thì đúng (mục 4.3.2). Với công việc và dự án, việc đặt bất biến chuyển trạng thái trong thực thể đã chặn các chuyển trạng thái Kanban không hợp lệ ngay tại miền.
4. **Observer / sự kiện miền** cho các mối quan tâm cắt ngang: kiểm toán, webhook, phân tích hiệu năng và thông báo thời gian thực đều đăng ký nghe sự kiện thay vì được gọi trực tiếp. Hai lỗi "thiếu sự kiện" (mục 6.9) cũng cho thấy mặt trái: một sự kiện không được phát thì mọi bên nghe đều im lặng, và chỉ kiểm thử đầu-cuối thấy được điều đó.
5. **Memento và sổ đăng ký bất biến** cho phiên bản quy trình làm cho việc khôi phục và ghim phiên bản trở nên đơn giản, vì lượt chạy không bao giờ thấy định nghĩa thay đổi dưới chân mình.
6. **Mediator** (`AgentMessageBus`) giữ cho các tác tử không biết nhau khi cộng tác, và tạo một điểm duy nhất để giới hạn số vòng và hiển thị hội thoại.

Các mẫu ít ảnh hưởng hơn đến điều phối nhưng hữu ích cho phần còn lại là Decorator (chi phí), Facade (một điểm gọi LLM), Chain of Responsibility (guard và chuỗi rà soát) và Port/Adapter (phân tích mã). Một quan sát chung là mẫu thiết kế hiệu quả nhất khi nó tạo ra **một điểm kiểm soát duy nhất**. Lỗ hổng phê duyệt qua WebSocket xuất hiện chính vì có một đường ghi thứ hai đi vòng qua điểm kiểm soát đó.

## RQ3: Tác tử học từ kết quả như thế nào, và đo điều đó ra sao?

Nền tảng có hai dạng học và chúng được đo theo cách khác nhau.

**Học để dự báo** dùng lịch sử các lượt chạy để ước lượng thời gian và chi phí. Dạng này đo được trực tiếp bằng sai số leave-one-out: sau tám dự án, MAPE theo vai trò từ 3% (Architect) đến 30% (DEV), và dự báo lúc bắt đầu sai trung bình khoảng 20% (mục 6.6). Sai số lớn nhất đến từ việc làm lại sau khi QA từ chối, một sự kiện không thể biết trước lúc bắt đầu. Vì vậy nền tảng hiển thị dự báo cạnh thực tế thay vì coi dự báo là cam kết.

**Học để cải thiện sản phẩm** là việc tinh luyện kết quả khách quan (cổng OOAD, kiểm thử của QC, phán quyết QA) thành bài học và nạp bài học vào lời nhắc của lần sau (mục 4.3.4). Các lần chạy đầu-cuối kiểm chứng rằng chuỗi này hoạt động đúng: kết quả được ghi cho đúng vai trò, bài học được tinh luyện sau mỗi N kết quả và xuất hiện trong lời nhắc tiếp theo. Tuy nhiên **luận văn không đo được mức cải thiện chất lượng nhờ học**. Với LLM kịch bản, câu trả lời không phụ thuộc vào bài học trong lời nhắc, nên mọi so sánh trước và sau sẽ cho kết quả bằng nhau theo cấu tạo. Báo cáo một con số cải thiện trong điều kiện đó sẽ là không trung thực.

Cách đo đúng được đề xuất như sau và là hướng phát triển đầu tiên ở chương 8: dùng LLM thật với nhiệt độ cố định; một tập dự án cố định chia hai nhóm, có học và không học (`LEARNING_REFINE_EVERY` tắt); chạy mỗi nhóm nhiều lần; so sánh tỉ lệ đạt cổng OOAD ngay lần đầu, số lần QA từ chối, số vòng sửa và chi phí làm lại, kèm kiểm định thống kê. Hạ tầng cần cho thí nghiệm này đã có sẵn: tín hiệu kết quả, phân tích hiệu năng theo vai trò và ghi chi phí từng lời gọi.

## Mối đe doạ đến tính hợp lệ của đánh giá

Phần này theo cách phân loại thường dùng trong nghiên cứu thực nghiệm kỹ nghệ phần mềm: hợp lệ nội tại, hợp lệ cấu trúc và hợp lệ ngoại tại.

**Hợp lệ nội tại: LLM kịch bản.** Mọi lần chạy đầu-cuối dùng một máy chủ LLM kịch bản tương thích OpenAI. Nó trả lời theo nội dung lời nhắc (tên dự án, vai trò, bước), có độ trễ và giá giả lập. Lựa chọn này làm cho kết quả lặp lại được và cho phép kiểm thử chính xác các nhánh khó tạo ra với LLM thật, như mã vi phạm phân lớp, QA từ chối hay mô hình ngừng hoạt động. Đổi lại, nó giới hạn những gì kết quả chứng minh được:

- Các kết quả về **luồng điều khiển** là hợp lệ: quy trình đi đúng nhánh, trạng thái được lưu, quyền được kiểm, chi phí được ghi, lỗi được xử lý. Chúng không phụ thuộc nội dung câu trả lời.
- Các kết quả về **chất lượng nội dung** chỉ là minh hoạ: độ chính xác 100% của dự đoán chất lượng mã (mục 6.7) đạt được vì lỗi được cài sẵn đúng loại bộ phân tích phát hiện được; số use case, số tệp và độ bao phủ use case của các dự án trình diễn phản ánh kịch bản chứ không phản ánh năng lực của một mô hình thật.
- Các con số **thời gian** bao gồm độ trễ giả lập (20 ms cộng 1 ms cho mỗi 25 ký tự lời nhắc). Với LLM thật, độ trễ mỗi lời gọi thường tính bằng giây và chi phối tổng thời gian; con số 2 giây cho mỗi nút được định nghĩa là không tính độ trễ LLM vì lý do này.
- Mô hình dự báo được huấn luyện trên thời lượng và chi phí do kịch bản sinh ra, nên MAPE thấp của Architect và CEO một phần là do hành vi giả lập ổn định. Với LLM thật, phương sai sẽ lớn hơn và sai số dự kiến cao hơn.

**Hợp lệ cấu trúc.** "Chất lượng OOAD" của dự án sinh ra được đo bằng cổng chất lượng và bộ phân tích tĩnh do chính luận văn định nghĩa: có đủ use case, thực thể, sơ đồ, không vi phạm phân lớp, độ phức tạp trong ngưỡng. Đây là các thước đo cần, chưa phải đủ; một thiết kế qua được cổng vẫn có thể là thiết kế kém theo đánh giá của chuyên gia. Tương tự, độ bao phủ mã đo dòng được thực thi chứ không đo chất lượng của khẳng định trong kiểm thử.

**Hợp lệ ngoại tại.** Kiểm thử tải chạy một tiến trình API trên một máy 4 lõi dùng chung với bộ sinh tải; con số thông lượng là giới hạn dưới cho cấu hình đó, không phải dự đoán cho một cụm máy. Các dự án sinh ra đều là ứng dụng TypeScript cỡ nhỏ (khoảng 35 tệp); kết quả chưa cho thấy nền tảng xử lý được dự án lớn hay ngôn ngữ khác. Chưa có nghiên cứu với người dùng thật nên không có kết luận về mức hữu ích đối với một nhóm phát triển.

**Giảm thiểu.** Để hạn chế các mối đe doạ trên, luận văn chỉ báo cáo số đo từ các lần chạy có lưu vết, tách rõ kết quả về luồng điều khiển với kết quả về nội dung, và công bố mã của LLM kịch bản cùng các script đo để người khác tái tạo hoặc thay bằng LLM thật (Phụ lục C và D).

## Các giới hạn của nền tảng

- **Sandbox:** môi trường kiểm thử không có Docker daemon, nên 15 kiểm thử của sandbox container bị bỏ qua và các lần chạy đầu-cuối chạy kiểm thử của dự án sinh ra trong một bản sao tạm trên máy chủ (`SANDBOX_ALLOW_LOCAL_RUN=true`). Cách này an toàn ở đây vì mã do LLM kịch bản viết, nhưng với LLM thật phải dùng sandbox container, và đường chạy đó chưa được kiểm chứng đầu-cuối.
- **Ngôn ngữ đích:** mẫu sản phẩm, bộ phân tích tĩnh và việc chạy kiểm thử chấp nhận chỉ hỗ trợ TypeScript.
- **Con người trong vòng lặp:** phê duyệt là một nút chặn đơn giản (duyệt hoặc từ chối kèm ghi chú). Chưa có chỉnh sửa sản phẩm trực tiếp rồi cho quy trình tiếp tục từ đó.
- **Mở rộng ngang:** API không giữ trạng thái nên có thể chạy nhiều tiến trình, nhưng cấu hình triển khai hiện chạy một tiến trình và chưa được kiểm thử tải ở chế độ nhiều bản sao. Kết nối WebSocket nhiều bản sao cần thêm bộ chuyển Redis cho Socket.IO.
- **Bảo mật:** các kiểm soát (phân quyền, khoá API, giới hạn tần suất, ký HMAC, kiểm toán, kiểm tra cấu hình production) đã được kiểm thử chức năng nhưng chưa qua kiểm thử xâm nhập độc lập. Lỗ hổng WebSocket ở mục 6.9 cho thấy giá trị của việc rà soát mọi đường ghi.
- **Chi phí:** ngân sách dừng quy trình khi vượt, nhưng chưa có ước lượng chi phí trước mỗi lời gọi để chặn sớm.
