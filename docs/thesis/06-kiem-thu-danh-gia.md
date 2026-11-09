# Kiểm thử và đánh giá

Chương này trình bày phương pháp kiểm chứng nền tảng và các kết quả đo được. Mọi số liệu đều được lấy từ các lần chạy có lưu vết trong kho mã; các lệnh để tái tạo kết quả được trình bày ở Phụ lục C và D.

## Chiến lược kiểm thử

Hoạt động kiểm thử được tổ chức theo mô hình kim tự tháp kiểm thử [52], gồm bốn mức:

1. **Kiểm thử đơn vị** cho tầng miền (hàm thuần, không cần giả lập) và cho các dịch vụ ứng dụng (dùng Repository trong bộ nhớ, LLM giả lập và sandbox giả lập).
2. **Kiểm thử tích hợp HTTP**: chạy một ứng dụng Nest thật với các guard, interceptor và controller thật, dữ liệu lưu trong bộ nhớ, và gọi qua giao thức HTTP.
3. **Kiểm thử đầu-cuối** trên hạ tầng thật, gồm API đã build, PostgreSQL, Redis, nginx, một LLM kịch bản tương thích OpenAI và trình duyệt Playwright cho giao diện. Mỗi lần chạy có một tệp điều khiển in ra một dòng cho mỗi kiểm tra và trả về mã lỗi khác 0 nếu có kiểm tra thất bại.
4. **Kiểm thử tải** với ngân sách thời gian phản hồi cho từng endpoint.

Việc sử dụng LLM kịch bản là một lựa chọn có chủ đích. LLM này trả lời theo nội dung lời nhắc (ví dụ, dự án có tên bắt đầu bằng "Legacy" sẽ nhận mã lần đầu vi phạm phân lớp), có độ trễ tăng theo độ dài lời nhắc và dùng một tên mô hình có bảng giá. Nhờ đó, thời lượng và chi phí thay đổi giữa các dự án, đủ để huấn luyện mô hình dự báo, trong khi mọi lần chạy vẫn cho cùng một kết quả.

## Kiểm thử tự động và độ bao phủ

| Bộ kiểm thử | Kết quả |
|-------------|---------|
| API (Jest) | 50 bộ, **707 đạt**, 15 bỏ qua (cần Docker daemon cho sandbox), 0 thất bại |
| Web (Vitest) | 44 đạt |
| Biên dịch | `nest build` 0 lỗi; `tsc --noEmit` của web 0 lỗi; `vite build` thành công |

Ngưỡng độ bao phủ được đặt trong cấu hình Jest, do đó lệnh `npm run test:cov` sẽ thất bại nếu không đạt ngưỡng:

| Phạm vi | Dòng | Lệnh | Hàm | Nhánh | Ngưỡng (dòng/lệnh/hàm/nhánh) |
|---------|-----:|-----:|----:|------:|------------------------------|
| Tầng miền (`src/domain`) | **97,1%** | **96,2%** | **97,0%** | **88,1%** | 90 / 90 / 90 / 85 |
| Toàn API | 77,8% | 77,7% | 74,4% | 63,5% | sàn 70 / 70 / 64 / 55 |

Ngưỡng 90% được áp dụng cho tầng miền thay vì cho toàn bộ API, vì tầng miền chứa các quy tắc nghiệp vụ, còn controller và phần kết nối với NestJS chủ yếu là mã khung; nếu áp ngưỡng 90% cho các phần này thì thực chất là kiểm thử chính framework. Toàn bộ API vẫn có ngưỡng sàn để độ bao phủ không bị giảm theo thời gian.

## Kiểm thử đầu-cuối

Bảng sau tóm tắt ba lần chạy đầu-cuối chính; mỗi lần đều bắt đầu từ một cơ sở dữ liệu trống.

| Lần chạy | Nội dung | Kết quả |
|----------|----------|---------|
| Triển khai và trình diễn | Cấu hình production qua nginx, dữ liệu trình diễn, phân quyền, phê duyệt, xuất PDF, phân tích, kiểm toán, nhà cung cấp LLM | **24/24** |
| Phân tích, dự báo, chất lượng mã | 8 dự án chạy qua toàn bộ quy trình OOAD, sau đó 3 lượt chạy khi mô hình của Marketing ngừng hoạt động; dùng bộ nhận webhook thật | **21/21** |
| Bảo mật, kiểm toán, tích hợp | Vai trò và quyền, nhật ký kiểm toán, khoá API, giới hạn tần suất, webhook ký HMAC, xuất dữ liệu, báo cáo | **44/44** |

Ngoài ra còn có các lần chạy riêng cho bộ máy quy trình (quy trình con, ghim phiên bản, ảnh chụp và khôi phục, nhánh song song) và cho hệ thống tác tử (lưu sản phẩm OOAD, thực thi kiểm thử của QC, cơ chế học, lập trình cặp).

Lần chạy triển khai kiểm tra những điều mà kiểm thử đơn vị không phát hiện được:

- Lệnh `prisma migrate deploy` dựng đúng lược đồ trên cơ sở dữ liệu trống (ba migration, trong đó có migration cho bảng nhà cung cấp LLM), và lược đồ thu được không sai lệch so với mô hình (`prisma migrate diff --exit-code` trả về 0).
- API ở chế độ production từ chối khởi động khi cấu hình sai (thiếu `JWT_SECRET` và `CORS_ORIGIN`, khoá LLM là `CHANGE_ME`): tiến trình thoát với mã 1 và thông báo liệt kê đủ ba lỗi.
- Khi truy cập qua nginx, điểm kiểm tra sức khoẻ báo cơ sở dữ liệu, Redis và cổng LLM đều ở trạng thái *healthy*. Khi dừng PostgreSQL, `/api/health` trả về mã 503 trong khi `/api/health/live` vẫn trả về 200; khi PostgreSQL khởi động lại, kết quả trở về 200.
- Swagger bị tắt khi `ENABLE_SWAGGER=false`; CORS chỉ trả về header cho nguồn gốc đã được cấu hình.
- Kết nối WebSocket qua nginx chấp nhận token đăng nhập hợp lệ và ngắt kết nối khi dùng token giả.
- Người xem không tạo được dự án, không phê duyệt được qua REST và cũng không phê duyệt được qua WebSocket (lỗ hổng này được phát hiện và sửa trong chính lần chạy này, xem mục 6.9).
- Một yêu cầu phê duyệt chỉ được trả lời một lần; câu trả lời thứ hai nhận mã 409. Tài khoản tự đăng ký nhận vai trò người xem. Cổng LLM trong cấu hình được nhập thành nhà cung cấp đầu tiên (19 mô hình), và API không trả về khoá của nhà cung cấp này.
- Sau khi thành viên hội đồng quản trị phê duyệt, CEO đóng dự án; nhật ký kiểm toán ghi nhận các sự kiện `auth.login`, `project.create`, `approval.requested`, `approval.approve`, `access.denied`, `quality.gate.evaluated`, `workflow.completed`.

![Phê duyệt đang chờ trên dự án Clinic Booking](../phase7-e2e/demo-approval.png){.wide}

## Thời gian xử lý của một nút quy trình

Yêu cầu phi chức năng đặt ra là mỗi nút quy trình được xử lý trong vòng 2 giây, không tính độ trễ của LLM, vì độ trễ này phụ thuộc vào nhà cung cấp và nằm ngoài tầm kiểm soát của nền tảng. Bảng sau trình bày thời lượng của 43 bước tác tử trong lần chạy triển khai. LLM kịch bản trả lời sau 20 ms cộng thêm 1 ms cho mỗi 25 ký tự lời nhắc, nên các con số dưới đây vẫn bao gồm một phần độ trễ giả lập.

| Vai trò | Số bước | p50 (ms) | p95 (ms) | Lớn nhất (ms) |
|---------|--------:|---------:|---------:|--------------:|
| CEO | 10 | 75 | 100 | 100 |
| BA | 5 | 107 | 121 | 121 |
| Architect | 5 | 582 | 607 | 607 |
| PM | 4 | 105 | 110 | 110 |
| DEV | 5 | 614 | 632 | 632 |
| QC | 5 | 1 642 | 1 726 | 1 726 |
| QA | 5 | 259 | 279 | 279 |
| Marketing | 4 | 75 | 81 | 81 |
| **Tất cả** | **43** | **110** | **1 642** | p99: **1 726** |

Mọi nút đều được xử lý dưới 2 giây. Kết quả gần như trùng với lần đo trước khi bộ máy được bổ sung bước kiểm tra ngân sách trước mỗi nút (p50 108 ms, p95 1 687 ms), cho thấy bước kiểm tra này không làm chậm hệ thống đáng kể. Nút chậm nhất là QC, vì tác tử này thực sự chạy bộ kiểm thử Jest của dự án sinh ra; Architect và DEV chậm hơn các vai trò khác do phải ghi nhiều tệp và chạy phân tích tĩnh.

## Hiệu năng dưới tải

Kiểm thử tải sử dụng một script không phụ thuộc thư viện ngoài, mô phỏng người dùng bảng điều khiển (xem danh sách và chi tiết dự án, công việc, báo cáo chi phí, phân tích tác tử, dự báo, chất lượng mã). Mỗi endpoint có ngân sách thời gian phản hồi p50/p95/p99: mặc định là 100/500/1000 ms; 300/1500/3000 ms cho phân tích, dự báo và chất lượng mã; 500/2000/3000 ms cho tạo dự án. Tỉ lệ lỗi tối đa cho phép là 1%. Môi trường kiểm thử gồm một tiến trình API ở chế độ production, PostgreSQL và Redis, chạy trên một máy 4 lõi dùng chung với bộ sinh tải và LLM kịch bản. Cơ sở dữ liệu bắt đầu từ dữ liệu trình diễn (5 dự án) và tăng dần khi các kịch bản tạo thêm dự án.

| Kịch bản | Yêu cầu/giây | Lỗi | Kết quả theo ngân sách |
|----------|-------------:|----:|------------------------|
| 1 người dùng | 184,7 | 0% | Mọi endpoint trong ngân sách; p50 từ 3 đến 7 ms |
| 20 người dùng, chỉ đọc | **604,8** | 0% | Mọi endpoint trong ngân sách; p95 cao nhất 84 ms |
| 20 người dùng, đồng thời tạo 111 dự án | 430,7 | 0% | Mọi endpoint trong ngân sách; tạo dự án p50 107 ms, p99 177 ms |
| 50 người dùng, tạo 48 dự án | 407,2 | 0% | Bão hoà: p50 77–312 ms, năm endpoint vượt ngân sách p50 100 ms; mọi p99 dưới 0,7 s |

Với 50 người dùng, một tiến trình API đã bão hoà ở mức khoảng 407 yêu cầu/giây. Theo định luật Little [41], mỗi yêu cầu khi đó phải chờ khoảng 50 / 407 ≈ 123 ms; đây là giới hạn của một tiến trình đơn lẻ, còn bản thân các truy vấn vẫn nhanh. Vì API không lưu trạng thái (các lượt chạy được điều phối qua BullMQ và PostgreSQL), có thể mở rộng hệ thống bằng cách chạy thêm tiến trình.

Lần đo trước, trên một cơ sở dữ liệu có khoảng 120 dự án, cho kết quả 201,8 yêu cầu/giây với 20 người dùng và bão hoà ở mức 178 yêu cầu/giây. Hai lần đo không so sánh trực tiếp được với nhau vì kích thước dữ liệu khác nhau, do đó luận văn không coi chênh lệch giữa chúng là mức cải thiện. Điểm có thể so sánh là kết quả theo ngân sách: trong cả hai lần đo, với 20 người dùng, mọi endpoint đều nằm trong hoặc sát ngân sách và không phát sinh lỗi. Lần đo trước đã phát hiện ba lỗi hiệu năng (mục 6.9); sau khi sửa, thời gian p50 của endpoint chất lượng mã giảm từ 3,1 s xuống 196 ms trong cùng kịch bản.

## Độ chính xác của dự báo

Sau khi 8 dự án hoàn tất, mọi vai trò đều có đủ mẫu để dùng mô hình hồi quy. Bảng sau trình bày sai số leave-one-out của dự báo thời gian tác tử.

| Vai trò | MAPE (LOO) |
|---------|-----------:|
| Architect | 3% |
| CEO | 5% |
| BA | 11% |
| DEV | 30% |

Dự báo tại thời điểm bắt đầu của 7 dự án (không tính dự án đầu tiên vì chưa có dữ liệu lịch sử) có sai số tuyệt đối trung bình là 21% về thời gian và 20% về chi phí. Phần lớn sai số đến từ một dự án mà QA từ chối mã và DEV phải làm lại (chi phí vượt dự báo 84%); các dự án còn lại có sai lệch từ 0 đến 10%. Kết quả này phù hợp với bản chất của bài toán: việc phải làm lại do bị từ chối không thể biết trước khi dự án bắt đầu. Vì vậy, nền tảng lưu cả dự báo tại thời điểm bắt đầu và dự báo khi PM lập kế hoạch, đồng thời luôn hiển thị dự báo bên cạnh kết quả thực tế.

## Dự đoán chất lượng mã

| Trường hợp | Diễn biến |
|------------|-----------|
| *Legacy Billing* | Mã lần đầu của DEV nhập tầng hạ tầng từ tầng miền, chứa khoá viết cứng, gọi `eval` và dồn các quy tắc vào một phương thức dài. Điểm 77 và có vi phạm phân lớp nên dự đoán là *fail*; DEV sửa một vòng, điểm tăng lên 100, bản sửa được giữ lại và QA duyệt |
| *Unsafe Portal* | Vòng sửa không cải thiện điểm nên bản gốc được giữ lại; QA phát hiện `eval` qua báo cáo phân tích và trả lời FAIL; quy trình quay lại DEV và lần thứ hai đạt |
| Toàn bộ | Trong 9 lần QA rà soát, 8 lần dự đoán *pass* và được duyệt, 1 lần dự đoán *fail* và bị từ chối |

Độ chính xác 100% trên 9 lần rà soát cần được diễn giải thận trọng, vì với LLM kịch bản, các lỗi được cài sẵn đúng loại mà bộ phân tích có thể phát hiện. Con số này cho thấy chuỗi dự đoán, sửa lỗi và đối chiếu hoạt động đúng, nhưng chưa chứng minh được độ chính xác khi dùng LLM thật (mục 7.4).

## Nghiên cứu tình huống

Năm dự án trình diễn được tạo thông qua API công khai giống như một người dùng thật; mỗi dự án minh hoạ một khía cạnh của nền tảng.

| Dự án | Mẫu quy trình | Kết quả |
|-------|---------------|---------|
| Online Bookstore | Dự án phần mềm OOAD | 5 use case, 3 thực thể, 3 mẫu thiết kế, đạt cổng OOAD 100%; 35 tệp; 4 kiểm thử chấp nhận chạy đạt; độ bao phủ use case 80%, UC-005 được báo thiếu kiểm thử; có thông báo marketing; hoàn tất |
| Legacy Billing | Dự án phần mềm OOAD | Phân tích tĩnh phát hiện vi phạm, DEV tự sửa (điểm từ 77 lên 100) trước khi QA rà soát; hoàn tất |
| Unsafe Portal | Dự án phần mềm OOAD | QA từ chối, quy trình quay lại DEV (2 bước DEV, 2 lần rà soát QA); hoàn tất |
| Library Loans | Chỉ phân tích và thiết kế | Use case, mô hình miền và sơ đồ vượt qua cổng OOAD; hoàn tất |
| Clinic Booking | Dự án phần mềm OOAD, có phê duyệt | Dừng ở bước phê duyệt; người xem không phê duyệt được; sau khi thành viên hội đồng quản trị phê duyệt, CEO đóng dự án |

Với LLM kịch bản, cả năm dự án được tạo và chạy xong trong khoảng 25 giây.

## Lỗi phát hiện nhờ kiểm thử và rà soát

Việc kiểm thử trên hạ tầng thật đã giúp phát hiện và sửa nhiều lỗi. Ngoài kiểm thử tự động, lỗi còn được phát hiện từ hai nguồn khác: một đợt rà soát mã có hệ thống đối với phần giao diện và logic, trong đó từng màn hình được đọc và đối chiếu với API mà màn hình đó gọi; và việc cài đặt mới từ mã nguồn trên một máy khác. Bảng sau tóm tắt các lỗi theo nhóm; danh sách đầy đủ kèm cách sửa nằm trong kế hoạch dự án và lịch sử thay đổi của kho mã.

| Nhóm | Ví dụ tiêu biểu | Kiểm thử | Rà soát | Cài đặt mới | Tổng |
|---------------|-------------------------------------------------------------|--------:|--------:|--------:|------:|
| Không khởi động / không chạy được | API không khởi động vì hai chiến lược có tham số hàm tạo mà DI không giải được; migration thiếu 8 bảng; nginx bỏ tiền tố `/api`; pnpm 8.0 lỗi trên Node 20; một bản clone mới không build ra `shared-types`; script dữ liệu trình diễn hỏng khi đăng ký mặc định thành người xem | 6 | 0 | 4 | 10 |
| Bảo mật | Duyệt qua WebSocket bỏ qua quyền và kiểm toán; ba giá trị dự phòng khác nhau cho khoá JWT; tự đăng ký nhận quyền thành viên hội đồng; một phê duyệt trả lời được hai lần; sửa công việc không kiểm tra chủ dự án | 3 | 3 | 0 | 6 |
| Thiết kế OOAD không được dùng | 4/8 tác tử vẫn chạy luồng cũ nên chiến lược là mã chết; cổng chất lượng không được đăng ký; sản phẩm của tác tử mất sau mỗi lệnh sandbox; quy trình lập kế hoạch trước khi có yêu cầu | 6 | 0 | 0 | 6 |
| Tính đúng của quy trình và trạng thái | Một máy trạng thái cho mỗi vai trò; nút thất bại để lượt chạy `running` mãi; *Pause* chỉ đổi trạng thái dự án; *Resume* ở bước phê duyệt tạo phê duyệt trùng; dự án đã huỷ bị đánh dấu hoàn tất; lý do từ chối không đến được tác tử | 8 | 6 | 0 | 14 |
| Chi phí và sự kiện | Chi phí LLM của 4 vai trò không được ghi; nút vẫn bắt đầu khi ngân sách đã hết; cộng chi phí kiểu đọc rồi ghi bị mất cập nhật khi đồng thời; không có sự kiện `approval.requested` và `workflow.failed` | 4 | 3 | 0 | 7 |
| Hiệu năng | Phân tích lại mọi tệp ở mỗi yêu cầu (3,1 s); danh sách dự án tải JSON không dùng; bốn truy vấn tuần tự | 3 | 0 | 0 | 3 |
| Tài liệu và giao diện | 12/39 sơ đồ UML không render được; thẻ dự án luôn "0%"; trang dự án tham gia phòng WebSocket sai payload nên không nhận sự kiện thời gian thực | 3 | 1 | 0 | 4 |
| **Tổng** | | **33** | **13** | **4** | **50** |

Cả mười ba lỗi do rà soát phát hiện đều nằm trên những luồng xử lý mà kiểm thử tự động chưa đi qua. Các kiểm thử đầu-cuối chạy quy trình từ đầu đến cuối, nhưng không tạm dừng rồi tiếp tục, không trả lời một phê duyệt hai lần, và không thực hiện hai lần cộng chi phí cùng lúc. Sau khi sửa, mỗi lỗi đều có một kiểm thử đơn vị riêng (`run-control.spec.ts`, `approval-and-signup.spec.ts`), và ba hành vi được bổ sung vào lần chạy đầu-cuối triển khai: phê duyệt chỉ được trả lời một lần, tài khoản đăng ký chỉ nhận quyền xem, và khoá của nhà cung cấp không bị trả về. Chính lần chạy lại này đã phát hiện script tạo dữ liệu trình diễn vẫn giả định rằng tài khoản tự đăng ký có vai trò thành viên hội đồng quản trị.

Lỗ hổng phê duyệt qua WebSocket là trường hợp đáng chú ý, vì mọi kiểm thử trước đó đều đi qua REST. Lỗ hổng chỉ bộc lộ khi kiểm thử đi theo đúng luồng mà giao diện sử dụng: người xem nhận mã 403 khi gọi `POST /api/approvals/:id/approve`, nhưng khi gửi thông điệp `human:approval_response` qua WebSocket thì phê duyệt vẫn được chấp nhận, dự án được đóng và không có mục kiểm toán nào được ghi. Bài học thiết kế rút ra là mọi luồng ghi dữ liệu phải đi qua cùng một điểm kiểm soát. Sau khi sửa, kênh WebSocket từ chối thông điệp này, giao diện chuyển sang dùng REST, và lần chạy đầu-cuối có một kiểm tra riêng cho trường hợp này.
