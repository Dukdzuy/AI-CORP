# Cơ sở lý thuyết và tổng quan

Chương này trình bày bốn mảng kiến thức mà nền tảng dựa vào: phân tích và thiết kế hướng đối tượng, hệ đa tác tử, điều phối quy trình, và ứng dụng trí tuệ nhân tạo trong kỹ nghệ phần mềm. Cuối chương nêu khoảng trống mà luận văn hướng tới.

## Phân tích và thiết kế hướng đối tượng

### Mô hình hoá bằng use case và UML

Jacobson đề xuất phát triển phần mềm hướng use case [3]: mỗi use case là một chuỗi tương tác giữa một tác nhân (actor) và hệ thống mang lại một kết quả có giá trị cho tác nhân đó. Use case vừa là đơn vị yêu cầu, vừa là đơn vị kiểm thử chấp nhận và là trục để truy vết đến thiết kế và mã. Các quan hệ `«include»` (hành vi con bắt buộc), `«extend»` (hành vi mở rộng có điều kiện) và tổng quát hoá giúp tránh lặp lại đặc tả.

Ngôn ngữ mô hình hoá thống nhất UML [1], [2] hợp nhất ký pháp của Booch, Rumbaugh và Jacobson. UML 2.5 chia sơ đồ thành hai nhóm: **cấu trúc** (lớp, đối tượng, thành phần, triển khai, gói, cấu trúc hỗn hợp) và **hành vi** (use case, tuần tự, hoạt động, máy trạng thái, giao tiếp, thời gian, tổng quan tương tác). Kruchten tổ chức tài liệu kiến trúc theo mô hình 4+1 góc nhìn (logic, tiến trình, phát triển, vật lý, cộng thêm kịch bản) [12]; luận văn dùng cách tổ chức tương tự với sáu nhóm sơ đồ: use case, lớp, tuần tự, hoạt động, máy trạng thái và kiến trúc (gói, thành phần, triển khai).

Larman mô tả một quy trình OOAD lặp: use case → mô hình miền (khái niệm, thuộc tính, liên kết, chưa có phương thức) → sơ đồ tuần tự hệ thống → hợp đồng thao tác → thiết kế lớp với các nguyên tắc gán trách nhiệm GRASP (Information Expert, Creator, Controller, Low Coupling, High Cohesion…) [9]. Nền tảng áp dụng đúng chuỗi này cho dự án sinh ra: tác tử BA viết use case, tác tử Architect dựng mô hình miền, sơ đồ lớp, sơ đồ tuần tự và chọn mẫu thiết kế.

### Các nguyên lý SOLID và mô-đun hoá

Parnas chỉ ra rằng tiêu chí phân rã mô-đun đúng là che giấu những quyết định dễ thay đổi [55]. Martin hệ thống hoá năm nguyên lý thiết kế lớp, gọi tắt là SOLID [7], [8]:

- **SRP** (Single Responsibility): một lớp chỉ có một lý do để thay đổi.
- **OCP** (Open/Closed), bắt nguồn từ Meyer [10]: mở để mở rộng, đóng để sửa đổi.
- **LSP** (Liskov Substitution) [11]: lớp con thay thế được lớp cha mà không phá vỡ hành vi mong đợi.
- **ISP** (Interface Segregation): nhiều giao diện nhỏ chuyên biệt tốt hơn một giao diện lớn.
- **DIP** (Dependency Inversion): mô-đun cấp cao và cấp thấp đều phụ thuộc vào trừu tượng.

Kiến trúc sạch (Clean Architecture) của Martin [8] và kiến trúc phân lớp của Evans [6] cùng đưa ra **quy tắc phụ thuộc**: mã ở vòng trong (miền) không biết gì về vòng ngoài (ứng dụng, hạ tầng, giao diện). Nền tảng dùng quy tắc này ở hai nơi: cho chính mã của nó, và như một luật được kiểm tra tự động trên mã do tác tử DEV sinh ra (mục 4.6).

### Mẫu thiết kế

Gamma và cộng sự (GoF) phân loại 23 mẫu thành ba nhóm: khởi tạo (Factory Method, Abstract Factory, Builder, Prototype, Singleton), cấu trúc (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy) và hành vi (Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor) [4]. Fowler bổ sung các mẫu cho ứng dụng doanh nghiệp như Repository, Data Mapper, Service Layer, Unit of Work, Domain Model [5]. Evans thêm các khối xây dựng của thiết kế hướng miền: Entity, Value Object, Aggregate, Domain Event, Repository, Factory, Domain Service [6].

Một mẫu chỉ có giá trị khi gắn với một vấn đề cụ thể trong ngữ cảnh. Vì vậy luận văn trình bày mẫu thiết kế dưới dạng bảng "vấn đề → mẫu → lớp hiện thực" (mục 4.2) thay vì liệt kê số lượng.

### Truy vết yêu cầu

Gotel và Finkelstein định nghĩa truy vết yêu cầu là khả năng theo dõi vòng đời của một yêu cầu theo cả hai chiều, từ nguồn gốc đến đặc tả, thiết kế, hiện thực và kiểm thử [44]. IEEE 830 coi tính truy vết được là một thuộc tính của đặc tả yêu cầu tốt [42]. Ma trận truy vết là công cụ phổ biến nhất; giá trị của nó phụ thuộc vào việc các ô được cập nhật từ dữ liệu thật (kiểm thử đã chạy) hay chỉ được điền tay. Nền tảng xây ma trận từ kết quả thực thi kiểm thử chấp nhận (mục 4.6).

### Chất lượng phần mềm: QA và QC

ISO 9000 phân biệt **đảm bảo chất lượng** (QA, tạo niềm tin rằng yêu cầu chất lượng sẽ được đáp ứng, tức hướng quy trình và phòng ngừa) với **kiểm soát chất lượng** (QC, đáp ứng yêu cầu chất lượng, tức hướng sản phẩm và phát hiện) [53]. ISO/IEC 25010 định nghĩa mô hình chất lượng sản phẩm với các đặc tính như tính phù hợp chức năng, hiệu năng, bảo mật, khả năng bảo trì (gồm tính mô-đun, khả năng tái sử dụng, khả năng phân tích, sửa đổi và kiểm thử) [43]. Sự phân biệt QA/QC là cơ sở để nền tảng tách hai tác tử với trách nhiệm khác nhau (mục 3.1).

## Hệ đa tác tử

### Tác tử và kiến trúc tác tử

Wooldridge định nghĩa tác tử là một hệ thống máy tính đặt trong một môi trường, có khả năng hành động tự chủ để đạt mục tiêu; tác tử thông minh có tính phản ứng, tính chủ động và năng lực xã hội [14]. Kiến trúc BDI (Belief–Desire–Intention) của Rao và Georgeff mô hình hoá tác tử bằng niềm tin về thế giới, mong muốn và ý định đã cam kết [15]. Chu trình "nhận thức – suy nghĩ – hành động" của BDI tương ứng trực tiếp với cặp phương thức `think()` / `act()` của tác tử trong nền tảng, trong đó bộ nhớ dài hạn đóng vai trò niềm tin và mục tiêu của công việc đóng vai trò mong muốn.

### Giao tiếp và phối hợp

FIPA chuẩn hoá ngôn ngữ giao tiếp tác tử (ACL) với các hành động ngôn từ (performative) như `inform`, `request`, `propose`, `accept-proposal`, `reject-proposal` [16]. Giao thức Contract Net của Smith là mô hình kinh điển cho phân công việc: người quản lý gọi thầu, các tác tử đề xuất, người quản lý trao hợp đồng [17]. Stone và Veloso phân loại hệ đa tác tử theo mức độ đồng nhất và mức độ giao tiếp giữa các tác tử [18].

Nền tảng chọn cách phối hợp **có điều phối trung tâm**: bộ máy quy trình quyết định tác tử nào làm gì theo một đồ thị đã định nghĩa, còn các tác tử trao đổi thông điệp có kiểu (INFORM, REQUEST, PROPOSE, ACCEPT, REJECT) qua một bus thông điệp (Mediator) trong các phiên cộng tác như lập trình cặp. Lựa chọn này đánh đổi tính tự chủ lấy tính dự đoán được và khả năng truy vết, phù hợp với mục tiêu của một quy trình phần mềm có cổng chất lượng.

## Điều phối quy trình

BPMN 2.0 là chuẩn ký pháp cho quy trình nghiệp vụ, với sự kiện, công việc, cổng (gateway) rẽ nhánh và song song [19]. Mạng Petri cung cấp nền tảng hình thức để phân tích tính đạt được, tính sống và tính bị chặn của quy trình [20]. Van der Aalst và cộng sự tổng hợp các mẫu quy trình (workflow patterns) như tuần tự, tách song song, đồng bộ, lựa chọn độc quyền, vòng lặp tuỳ ý và quy trình con [21]. Statecharts của Harel mở rộng máy trạng thái hữu hạn với trạng thái lồng và song song [33], là cơ sở cho sơ đồ máy trạng thái của UML.

Bộ máy quy trình của nền tảng hiện thực tập con các mẫu cần cho phát triển phần mềm: tuần tự, lựa chọn có điều kiện (theo phán quyết của QA), vòng lặp (QA từ chối → DEV), tách và đồng bộ song song có phụ thuộc, quy trình con, và điểm dừng chờ con người duyệt. Đồ thị được kiểm tra không chu trình bằng sắp xếp tô-pô, trừ các cạnh quay lui được khai báo tường minh.

## Trí tuệ nhân tạo trong kỹ nghệ phần mềm

### Mô hình ngôn ngữ lớn và sinh mã

Kiến trúc Transformer [32] là nền tảng của các LLM hiện nay. Chen và cộng sự giới thiệu Codex và bộ đánh giá HumanEval cho bài toán sinh hàm từ mô tả [22]. SWE-bench đo khả năng giải các issue thật trên GitHub và cho thấy khoảng cách lớn giữa sinh một hàm và sửa một kho mã [23]. Gợi ý chuỗi suy luận (chain-of-thought) cải thiện khả năng suy luận nhiều bước [30]; ReAct xen kẽ suy luận và hành động gọi công cụ [27]; sinh tăng cường truy xuất (RAG) đưa tri thức bên ngoài vào ngữ cảnh [31].

### Tác tử LLM và hệ đa tác tử cho phát triển phần mềm

MetaGPT mã hoá quy trình vận hành chuẩn (SOP) của một công ty phần mềm thành các vai trò (quản lý sản phẩm, kiến trúc sư, kỹ sư…) trao đổi tài liệu có cấu trúc [24]. ChatDev tổ chức phát triển thành các giai đoạn thiết kế, lập trình, kiểm thử, mỗi giai đoạn là cuộc hội thoại giữa hai vai trò [25]. AutoGen cung cấp khung lập trình cho hội thoại nhiều tác tử [26]. Về học từ kinh nghiệm, Reflexion cho tác tử tự viết nhận xét về thất bại và đưa vào lần thử sau [28]; Generative Agents lưu ký ức, truy xuất theo độ liên quan và tổng hợp thành suy ngẫm [29].

Cơ chế học của nền tảng gần với Reflexion và Generative Agents: mỗi kết quả của tác tử được chấm bởi một tín hiệu khách quan (cổng OOAD, kết quả kiểm thử của QC, phán quyết của QA), và định kỳ các kết quả được tinh luyện thành bài học lưu trong bộ nhớ của vai trò đó để đưa vào lời nhắc lần sau (mục 4.3.4).

### Đo chất lượng mã và ước lượng công sức

McCabe định nghĩa độ phức tạp chu trình (cyclomatic complexity) bằng số đường độc lập qua đồ thị luồng điều khiển [35]. Halstead đo thể tích chương trình từ số toán tử và toán hạng [36]. Oman, Hagemeister và Coleman kết hợp hai độ đo này với số dòng thành chỉ số bảo trì (Maintainability Index) [37], [38]. Về ước lượng, COCOMO của Boehm là mô hình hồi quy kinh điển giữa kích thước và công sức [39]; hồi quy ridge [40] thêm phạt chuẩn L2 để ổn định khi dữ liệu ít và các biến tương quan; kiểm định chéo bỏ một (leave-one-out) cho ước lượng ít thiên lệch về sai số tổng quát khi mẫu nhỏ [46].

## Khoảng trống nghiên cứu

Các hệ đa tác tử cho phát triển phần mềm hiện có [24]–[26] tập trung vào việc sinh ra mã chạy được. Ba khía cạnh ít được đề cập:

1. **Bản thân hệ thống** hiếm khi được trình bày như một sản phẩm OOAD có mô hình miền, mẫu thiết kế gắn với vấn đề, và kiểm thử đo được độ bao phủ.
2. **Sản phẩm của tác tử** thường thiếu chuỗi truy vết từ use case qua thiết kế đến kiểm thử đã thực thi, và thiếu cổng kiểm tra rằng mã tuân thủ kiến trúc đã thiết kế.
3. **Đánh giá** thường dựa trên tỉ lệ thành công tổng thể, ít khi đo riêng từng vai trò theo tiêu chí phù hợp với vai trò đó, và ít khi so dự báo với kết quả thực tế.

Luận văn hướng tới cả ba khía cạnh này, với giới hạn được nêu ở mục 1.3: các phép đo dùng LLM kịch bản để lặp lại được.
