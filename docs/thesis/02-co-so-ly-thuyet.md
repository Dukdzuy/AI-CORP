# Cơ sở lý thuyết và tổng quan

Chương này trình bày bốn nhóm kiến thức làm cơ sở cho nền tảng: phân tích và thiết kế hướng đối tượng, hệ đa tác tử, điều phối quy trình và ứng dụng trí tuệ nhân tạo trong kỹ nghệ phần mềm. Phần cuối chương chỉ ra khoảng trống nghiên cứu mà luận văn hướng tới.

## Phân tích và thiết kế hướng đối tượng

### Mô hình hoá bằng use case và UML

Jacobson đề xuất phương pháp phát triển phần mềm hướng use case [3], trong đó mỗi use case là một chuỗi tương tác giữa một tác nhân (actor) và hệ thống, mang lại một kết quả có giá trị cho tác nhân đó. Use case vừa là đơn vị yêu cầu, vừa là đơn vị kiểm thử chấp nhận, đồng thời là trục để truy vết đến thiết kế và mã nguồn. Các quan hệ `«include»` (hành vi con bắt buộc), `«extend»` (hành vi mở rộng có điều kiện) và tổng quát hoá giúp tránh lặp lại đặc tả.

Ngôn ngữ mô hình hoá thống nhất UML [1], [2] hợp nhất ký pháp của Booch, Rumbaugh và Jacobson. UML 2.5 chia các sơ đồ thành hai nhóm: nhóm cấu trúc (lớp, đối tượng, thành phần, triển khai, gói, cấu trúc hỗn hợp) và nhóm hành vi (use case, tuần tự, hoạt động, máy trạng thái, giao tiếp, thời gian, tổng quan tương tác). Kruchten tổ chức tài liệu kiến trúc theo mô hình 4+1 góc nhìn (logic, tiến trình, phát triển, vật lý, cộng thêm kịch bản) [12]; luận văn sử dụng cách tổ chức tương tự với sáu nhóm sơ đồ: use case, lớp, tuần tự, hoạt động, máy trạng thái và kiến trúc (gói, thành phần, triển khai).

Larman mô tả một quy trình OOAD lặp gồm các bước: xác định use case; xây dựng mô hình miền (khái niệm, thuộc tính, liên kết, chưa có phương thức); vẽ sơ đồ tuần tự hệ thống; viết hợp đồng thao tác; và thiết kế lớp theo các nguyên tắc gán trách nhiệm GRASP (Information Expert, Creator, Controller, Low Coupling, High Cohesion, v.v.) [9]. Nền tảng áp dụng chính chuỗi bước này cho các dự án sinh ra: tác tử BA viết use case, còn tác tử Architect xây dựng mô hình miền, sơ đồ lớp, sơ đồ tuần tự và lựa chọn mẫu thiết kế.

### Các nguyên lý SOLID và mô-đun hoá

Parnas chỉ ra rằng tiêu chí đúng đắn để phân rã mô-đun là che giấu những quyết định thiết kế dễ thay đổi [55]. Martin hệ thống hoá năm nguyên lý thiết kế lớp, gọi tắt là SOLID [7], [8]:

- **SRP** (Single Responsibility): một lớp chỉ có một lý do để thay đổi.
- **OCP** (Open/Closed), bắt nguồn từ Meyer [10]: mở để mở rộng, đóng để sửa đổi.
- **LSP** (Liskov Substitution) [11]: lớp con thay thế được lớp cha mà không phá vỡ hành vi mong đợi.
- **ISP** (Interface Segregation): nhiều giao diện nhỏ chuyên biệt tốt hơn một giao diện lớn.
- **DIP** (Dependency Inversion): mô-đun cấp cao và cấp thấp đều phụ thuộc vào trừu tượng.

Kiến trúc sạch (Clean Architecture) của Martin [8] và kiến trúc phân lớp của Evans [6] cùng đưa ra quy tắc phụ thuộc (dependency rule): mã ở vòng trong (tầng miền) không được biết đến các vòng ngoài (ứng dụng, hạ tầng, giao diện). Nền tảng áp dụng quy tắc này ở hai nơi: cho mã nguồn của chính nền tảng, và như một luật được kiểm tra tự động trên mã do tác tử DEV sinh ra (mục 4.6).

### Mẫu thiết kế

Gamma và cộng sự (nhóm GoF) phân loại 23 mẫu thiết kế thành ba nhóm: khởi tạo (Factory Method, Abstract Factory, Builder, Prototype, Singleton), cấu trúc (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy) và hành vi (Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor) [4]. Fowler bổ sung các mẫu dành cho ứng dụng doanh nghiệp như Repository, Data Mapper, Service Layer, Unit of Work và Domain Model [5]. Evans đưa ra các khối xây dựng của thiết kế hướng miền: Entity, Value Object, Aggregate, Domain Event, Repository, Factory, Domain Service [6].

Một mẫu thiết kế chỉ có giá trị khi được gắn với một vấn đề cụ thể trong ngữ cảnh. Vì vậy, luận văn trình bày các mẫu thiết kế dưới dạng bảng gồm ba cột: vấn đề, mẫu được chọn và lớp hiện thực (mục 4.2).

### Truy vết yêu cầu

Gotel và Finkelstein định nghĩa truy vết yêu cầu là khả năng theo dõi vòng đời của một yêu cầu theo cả hai chiều, từ nguồn gốc đến đặc tả, thiết kế, hiện thực và kiểm thử [44]. Chuẩn IEEE 830 coi tính truy vết được là một thuộc tính của một bản đặc tả yêu cầu tốt [42]. Ma trận truy vết là công cụ phổ biến nhất cho mục đích này; giá trị của ma trận phụ thuộc vào việc các ô được cập nhật từ dữ liệu thực (kiểm thử đã chạy) hay chỉ được điền thủ công. Nền tảng xây dựng ma trận truy vết từ kết quả thực thi kiểm thử chấp nhận (mục 4.6).

### Chất lượng phần mềm: QA và QC

Bộ tiêu chuẩn ISO 9000 phân biệt đảm bảo chất lượng (QA), tức tạo niềm tin rằng yêu cầu chất lượng sẽ được đáp ứng, với kiểm soát chất lượng (QC), tức trực tiếp đáp ứng yêu cầu chất lượng [53]. QA hướng vào quy trình và mang tính phòng ngừa, còn QC hướng vào sản phẩm và mang tính phát hiện. Tiêu chuẩn ISO/IEC 25010 định nghĩa mô hình chất lượng sản phẩm với các đặc tính như tính phù hợp chức năng, hiệu năng, bảo mật, khả năng bảo trì (gồm tính mô-đun, khả năng tái sử dụng, khả năng phân tích, sửa đổi và kiểm thử) [43]. Sự phân biệt giữa QA và QC là cơ sở để nền tảng tách thành hai tác tử với trách nhiệm khác nhau (mục 3.1).

## Hệ đa tác tử

### Tác tử và kiến trúc tác tử

Wooldridge định nghĩa tác tử là một hệ thống máy tính đặt trong một môi trường, có khả năng hành động tự chủ để đạt được mục tiêu; tác tử thông minh có tính phản ứng, tính chủ động và năng lực xã hội [14]. Kiến trúc BDI (Belief-Desire-Intention) của Rao và Georgeff mô hình hoá tác tử thông qua niềm tin về thế giới, mong muốn và ý định đã cam kết [15]. Chu trình nhận thức, suy nghĩ và hành động của BDI tương ứng trực tiếp với cặp phương thức `think()` / `act()` của tác tử trong nền tảng, trong đó bộ nhớ dài hạn đóng vai trò niềm tin và mục tiêu của công việc đóng vai trò mong muốn.

### Giao tiếp và phối hợp

FIPA chuẩn hoá ngôn ngữ giao tiếp tác tử (ACL) với các hành động ngôn từ (performative) như `inform`, `request`, `propose`, `accept-proposal`, `reject-proposal` [16]. Giao thức Contract Net của Smith là mô hình kinh điển cho việc phân công: người quản lý gọi thầu, các tác tử gửi đề xuất, sau đó người quản lý trao hợp đồng [17]. Stone và Veloso phân loại hệ đa tác tử theo mức độ đồng nhất và mức độ giao tiếp giữa các tác tử [18].

Nền tảng lựa chọn cách phối hợp có điều phối trung tâm. Bộ máy quy trình quyết định tác tử nào thực hiện việc gì theo một đồ thị đã định nghĩa trước, còn các tác tử trao đổi thông điệp có kiểu (INFORM, REQUEST, PROPOSE, ACCEPT, REJECT) qua một bus thông điệp (mẫu Mediator) trong các phiên cộng tác như lập trình cặp. Lựa chọn này chấp nhận giảm tính tự chủ của tác tử để đổi lấy tính dự đoán được và khả năng truy vết, phù hợp với một quy trình phát triển phần mềm có cổng chất lượng.

## Điều phối quy trình

BPMN 2.0 là chuẩn ký pháp cho quy trình nghiệp vụ, gồm các phần tử sự kiện, công việc và cổng (gateway) rẽ nhánh hoặc song song [19]. Mạng Petri cung cấp nền tảng hình thức để phân tích tính đạt được, tính sống và tính bị chặn của quy trình [20]. Van der Aalst và cộng sự tổng hợp các mẫu quy trình (workflow patterns) như tuần tự, tách song song, đồng bộ, lựa chọn độc quyền, vòng lặp tuỳ ý và quy trình con [21]. Statecharts của Harel mở rộng máy trạng thái hữu hạn với trạng thái lồng nhau và trạng thái song song [33], và là cơ sở cho sơ đồ máy trạng thái của UML.

Bộ máy quy trình của nền tảng hiện thực một tập con các mẫu cần thiết cho phát triển phần mềm: tuần tự, lựa chọn có điều kiện (theo phán quyết của QA), vòng lặp (khi QA từ chối, công việc quay lại DEV), tách và đồng bộ song song có phụ thuộc, quy trình con, và điểm dừng chờ con người phê duyệt. Đồ thị được kiểm tra không chu trình bằng sắp xếp tô-pô, trừ các cạnh quay lui được khai báo tường minh.

## Trí tuệ nhân tạo trong kỹ nghệ phần mềm

### Mô hình ngôn ngữ lớn và sinh mã

Kiến trúc Transformer [32] là cơ sở của các LLM hiện nay. Chen và cộng sự giới thiệu Codex và bộ đánh giá HumanEval cho bài toán sinh hàm từ mô tả [22]. SWE-bench đo khả năng giải quyết các issue thực tế trên GitHub và cho thấy khoảng cách lớn giữa việc sinh một hàm và việc sửa lỗi trong cả một kho mã [23]. Kỹ thuật gợi ý chuỗi suy luận (chain-of-thought) cải thiện khả năng suy luận nhiều bước [30]; ReAct xen kẽ các bước suy luận với hành động gọi công cụ [27]; còn sinh tăng cường truy xuất (RAG) đưa tri thức bên ngoài vào ngữ cảnh của mô hình [31].

### Tác tử LLM và hệ đa tác tử cho phát triển phần mềm

MetaGPT mã hoá quy trình vận hành chuẩn (SOP) của một công ty phần mềm thành các vai trò (quản lý sản phẩm, kiến trúc sư, kỹ sư, v.v.) trao đổi tài liệu có cấu trúc với nhau [24]. ChatDev chia quá trình phát triển thành các giai đoạn thiết kế, lập trình và kiểm thử, trong đó mỗi giai đoạn là một cuộc hội thoại giữa hai vai trò [25]. AutoGen cung cấp một khung lập trình cho hội thoại giữa nhiều tác tử [26]. Về học từ kinh nghiệm, Reflexion cho phép tác tử tự viết nhận xét về các lần thất bại và đưa nhận xét đó vào lần thử tiếp theo [28]; Generative Agents lưu trữ ký ức, truy xuất theo mức độ liên quan và tổng hợp thành các suy ngẫm [29].

Cơ chế học của nền tảng gần với Reflexion và Generative Agents. Mỗi kết quả của tác tử được đánh giá bằng một tín hiệu khách quan (cổng OOAD, kết quả kiểm thử của QC, phán quyết của QA); định kỳ, các kết quả này được chắt lọc thành bài học, lưu trong bộ nhớ của vai trò tương ứng và đưa vào lời nhắc ở những lần sau (mục 4.3.4).

### Đo chất lượng mã và ước lượng công sức

McCabe định nghĩa độ phức tạp chu trình (cyclomatic complexity) là số đường đi độc lập qua đồ thị luồng điều khiển [35]. Halstead đo thể tích chương trình dựa trên số toán tử và toán hạng [36]. Oman, Hagemeister và Coleman kết hợp hai độ đo này với số dòng mã để tạo thành chỉ số bảo trì (Maintainability Index) [37], [38]. Về ước lượng công sức, COCOMO của Boehm là mô hình hồi quy kinh điển giữa kích thước và công sức [39]. Hồi quy ridge [40] bổ sung số hạng phạt chuẩn L2 để mô hình ổn định hơn khi dữ liệu ít và các biến có tương quan với nhau. Phương pháp kiểm định chéo bỏ một (leave-one-out) cho ước lượng sai số tổng quát ít thiên lệch khi kích thước mẫu nhỏ [46].

## Khoảng trống nghiên cứu

Các hệ đa tác tử cho phát triển phần mềm hiện có [24]–[26] tập trung vào việc sinh ra mã nguồn chạy được. Có ba khía cạnh còn ít được đề cập:

1. Bản thân các hệ thống này hiếm khi được trình bày như một sản phẩm OOAD có mô hình miền, có mẫu thiết kế gắn với vấn đề cụ thể và có kiểm thử với độ bao phủ đo được.
2. Sản phẩm do tác tử tạo ra thường thiếu chuỗi truy vết từ use case qua thiết kế đến kiểm thử đã thực thi, và thiếu một cổng kiểm tra xem mã nguồn có tuân thủ kiến trúc đã thiết kế hay không.
3. Việc đánh giá thường dựa trên tỉ lệ thành công tổng thể, ít khi đo riêng từng vai trò theo tiêu chí phù hợp với vai trò đó, và ít khi so sánh dự báo với kết quả thực tế.

Luận văn giải quyết cả ba khía cạnh trên, trong giới hạn đã nêu ở mục 1.3 là các phép đo sử dụng LLM kịch bản để bảo đảm tính lặp lại.
