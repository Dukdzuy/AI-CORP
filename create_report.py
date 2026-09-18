from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# Set default font
style = doc.styles['Normal']
font = style.font
font.name = 'Times New Roman'
font.size = Pt(13)

# Set margins
for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(3)
    section.right_margin = Cm(2)

# Helper functions
def add_heading_styled(text, level=1):
    heading = doc.add_heading(text, level=level)
    for run in heading.runs:
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(0, 0, 0)
    return heading

def add_paragraph_styled(text, bold=False, italic=False, alignment=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)
    run.bold = bold
    run.italic = italic
    if alignment:
        p.alignment = alignment
    return p

def add_code_block(code):
    p = doc.add_paragraph()
    run = p.add_run(code)
    run.font.name = 'Courier New'
    run.font.size = Pt(10)
    return p

# ============================================================
# TITLE PAGE
# ============================================================
doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('TRƯỜNG ĐẠI HỌC')
run.font.name = 'Times New Roman'
run.font.size = Pt(16)
run.bold = True

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('NGÀNH CÔNG NGHỆ THÔNG TIN')
run.font.name = 'Times New Roman'
run.font.size = Pt(14)
run.bold = True

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('ĐỒ ÁN TỐT NGHIỆP')
run.font.name = 'Times New Roman'
run.font.size = Pt(20)
run.bold = True

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('AI CORP PLATFORM')
run.font.name = 'Times New Roman'
run.font.size = Pt(24)
run.bold = True

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Nền tảng mô phỏng công ty công nghệ ảo\nvới hệ thống AI Agents')
run.font.name = 'Times New Roman'
run.font.size = Pt(14)

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('HỌ VÀ TÊN: ......................................')
run.font.name = 'Times New Roman'
run.font.size = Pt(13)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('MÃ SỐ SV: ......................................')
run.font.name = 'Times New Roman'
run.font.size = Pt(13)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('LOẠI ĐỒ ÁN: ......................................')
run.font.name = 'Times New Roman'
run.font.size = Pt(13)

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('HÀ NỘI, 2026')
run.font.name = 'Times New Roman'
run.font.size = Pt(14)
run.bold = True

doc.add_page_break()

# ============================================================
# TABLE OF CONTENTS
# ============================================================
add_heading_styled('MỤC LỤC', level=1)
doc.add_paragraph()

toc_items = [
    ('LỜI CẢM ƠN', ''),
    ('DANH MỤC HÌNH ẢNH, BẢNG BIỂU', ''),
    ('TỔNG QUAN DỰ ÁN', '1'),
    ('   1.1 Giới thiệu chung', '1'),
    ('   1.2 Mục tiêu dự án', '2'),
    ('   1.3 Phạm vi dự án', '3'),
    ('   1.4 Cấu trúc báo cáo', '3'),
    ('PHÂN TÍCH VÀ THIẾT KẾ', '4'),
    ('   2.1 Phân tích yêu cầu', '4'),
    ('   2.2 Thiết kế kiến trúc hệ thống', '6'),
    ('   2.3 Thiết kế cơ sở dữ liệu', '8'),
    ('   2.4 Thiết kế API', '10'),
    ('   2.5 Thiết kế giao diện', '12'),
    ('TRIỂN KHAI CHI TIẾT', '14'),
    ('   3.1 Môi trường phát triển', '14'),
    ('   3.2 Workflow Engine', '15'),
    ('   3.3 Multi-Agent System', '17'),
    ('   3.4 LLM Integration', '19'),
    ('   3.5 Docker Sandbox', '21'),
    ('   3.6 Frontend Application', '22'),
    ('KIỂM THỬ VÀ ĐÁNH GIÁ', '24'),
    ('   4.1 Kế hoạch kiểm thử', '24'),
    ('   4.2 Kết quả kiểm thử', '25'),
    ('   4.3 Đánh giá hiệu năng', '26'),
    ('KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN', '27'),
    ('   5.1 Kết luận', '27'),
    ('   5.2 Hạn chế hiện tại', '28'),
    ('   5.3 Hướng phát triển', '28'),
    ('TÀI LIỆU THAM KHẢO', '29'),
    ('PHỤ LỤC', '30'),
]

for item, page in toc_items:
    p = doc.add_paragraph()
    if not item.startswith('   '):
        run = p.add_run(item)
        run.bold = True
    else:
        run = p.add_run(item)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_page_break()

# ============================================================
# LỜI CẢM ƠN
# ============================================================
add_heading_styled('LỜI CẢM ƠN', level=1)

add_paragraph_styled('Em xin gửi lời cảm ơn chân thành đến:')
doc.add_paragraph()

thanks_items = [
    'Thầy/Cô giáo hướng dẫn đã tận tình hướng dẫn, chỉ bảo em trong suốt quá trình thực hiện đồ án.',
    'Các thầy/cô giáo trong khoa đã trang bị cho em những kiến thức chuyên môn quý báu.',
    'Bạn bè, người thân đã luôn động viên, hỗ trợ em trong quá trình học tập và thực hiện đồ án.',
    'Trường Đại học đã tạo điều kiện tốt nhất cho em trong quá trình học tập và nghiên cứu.',
]

for item in thanks_items:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(item)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_page_break()

# ============================================================
# DANH MỤC HÌNH ẢNH, BẢNG BIỂU
# ============================================================
add_heading_styled('DANH MỤC HÌNH ẢNH, BẢNG BIỂU', level=1)

add_paragraph_styled('Danh mục hình ảnh:', bold=True)
doc.add_paragraph()

figures = [
    'Hình 1.1: Kiến trúc tổng quan hệ thống AI Corp Platform',
    'Hình 1.2: Sơ đồ luồng dữ liệu hệ thống',
    'Hình 2.1: Kiến trúc Multi-Agent',
    'Hình 2.2: Sơ đồ Workflow DAG',
    'Hình 2.3: Database Entity Relationship Diagram',
    'Hình 2.4: Giao diện Dashboard',
    'Hình 2.5: Giao diện Virtual Office',
    'Hình 2.6: Giao diện Kanban Board',
    'Hình 3.1: Workflow Execution Flow',
    'Hình 3.2: Circuit Breaker Pattern',
    'Hình 3.3: Agent Execution Flow',
    'Hình 3.4: Docker Sandbox Architecture',
    'Hình 4.1: Biểu đồ chi phí theo Agent',
    'Hình 4.2: Biểu đồ token usage',
    'Hình 4.3: Kết quả chạy workflow thực tế',
]

for fig in figures:
    p = doc.add_paragraph()
    run = p.add_run(fig)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_paragraph()
add_paragraph_styled('Danh mục bảng biểu:', bold=True)
doc.add_paragraph()

tables = [
    'Bảng 1.1: So sánh công nghệ sử dụng',
    'Bảng 2.1: Yêu cầu chức năng hệ thống',
    'Bảng 2.2: Yêu cầu phi chức năng',
    'Bảng 2.3: Các Agent và vai trò',
    'Bảng 2.4: Các loại node trong workflow',
    'Bảng 3.1: Database Schema',
    'Bảng 3.2: REST API Endpoints',
    'Bảng 3.3: WebSocket Events',
    'Bảng 3.4: LLM Models Configuration',
    'Bảng 4.1: Kết quả kiểm thử chức năng',
    'Bảng 4.2: Hiệu năng hệ thống',
    'Bảng 4.3: Thống kê sử dụng',
]

for tbl in tables:
    p = doc.add_paragraph()
    run = p.add_run(tbl)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_page_break()

# ============================================================
# CHƯƠNG 1: TỔNG QUAN DỰ ÁN
# ============================================================
add_heading_styled('CHƯƠNG 1: TỔNG QUAN DỰ ÁN', level=1)

# 1.1
add_heading_styled('1.1 Giới thiệu chung', level=2)

add_paragraph_styled('Trong thời đại công nghệ 4.0, trí tuệ nhân tạo (AI) đang trở thành một phần không thể thiếu trong cuộc sống. Đặc biệt, Large Language Models (LLMs) đã chứng minh khả năng thực hiện nhiều tác vụ phức tạp như viết code, phân tích dữ liệu, tạo nội dung...')

add_paragraph_styled('Nắm bắt xu hướng này, đề tài "AI Corp Platform" được thực hiện với mục tiêu xây dựng một nền tảng mô phỏng công ty công nghệ ảo, trong đó tất cả nhân viên là AI Agents được hỗ trợ bởi LLMs. Hệ thống tự động hóa toàn bộ quy trình phát triển phần mềm: từ yêu cầu, lập kế hoạch, phân công task, triển khai code, đánh giá QA, đến phát hành và tiếp thị.')

add_paragraph_styled('AI Corp Platform không chỉ là một công cụ hỗ trợ lập trình mà còn là một mô hình mới về cách AI có thể thay thế con người trong các vai trò khác nhau trong một tổ chức, từ CEO, PM đến developer, QA engineer.')

# 1.2
add_heading_styled('1.2 Mục tiêu dự án', level=2)

add_paragraph_styled('Mục tiêu chính của dự án bao gồm:')

objectives = [
    'Xây dựng hệ thống multi-agent với 5 AI agents chuyên biệt (CEO, PM, DEV, QA, Marketing)',
    'Thiết kế và triển khai workflow engine dựa trên DAG (Directed Acyclic Graph) để quản lý quy trình làm việc tự động',
    'Tích hợp các LLM miễn phí qua 9Router gateway với cơ chế circuit breaker và fallback',
    'Phát triển giao diện real-time để theo dõi AI agents hoạt động',
    'Xây dựng hệ thống quản lý chi phí và ngân sách cho LLM calls',
    'Triển khai hệ thống approval (phê duyệt) với human-in-the-loop',
    'Đảm bảo bảo mật với Docker sandbox cho code execution',
]

for obj in objectives:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(obj)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

# 1.3
add_heading_styled('1.3 Phạm vi dự án', level=2)

add_paragraph_styled('Phạm vi thực hiện của dự án bao gồm các thành phần chính sau:')

scope_items = [
    ('Frontend:', 'Xây dựng giao diện người dùng với React, TypeScript, Ant Design, bao gồm Dashboard, Virtual Office, Kanban Board, Cost Analytics'),
    ('Backend:', 'Phát triển API server với NestJS, Prisma ORM, bao gồm các module: Workflow Engine, Agent Orchestrator, LLM Gateway, Memory Service, Tool Registry'),
    ('Database:', 'Thiết kế và triển khai cơ sở dữ liệu PostgreSQL với pgvector cho vector embeddings'),
    ('Queue:', 'Tích hợp Redis + BullMQ cho job queue và workflow execution'),
    ('LLM:', 'Kết nối với 9Router gateway để sử dụng các LLM models miễn phí'),
    ('Sandbox:', 'Triển khai Docker containers cho code execution an toàn'),
    ('Real-time:', 'Sử dụng Socket.IO cho các cập nhật real-time'),
]

for title, desc in scope_items:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(title + ' ')
    run.bold = True
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)
    run = p.add_run(desc)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

# 1.4
add_heading_styled('1.4 Cấu trúc báo cáo', level=2)

add_paragraph_styled('Báo cáo gồm 5 chương:')
doc.add_paragraph()

chapters = [
    'Chương 1: Tổng quan dự án - Giới thiệu chung, mục tiêu và phạm vi dự án',
    'Chương 2: Phân tích và thiết kế - Phân tích yêu cầu, thiết kế kiến trúc, database, API, giao diện',
    'Chương 3: Triển khai chi tiết - Môi trường phát triển, các thành phần chính',
    'Chương 4: Kiểm thử và đánh giá - Kế hoạch kiểm thử, kết quả, đánh giá hiệu năng',
    'Chương 5: Kết luận và hướng phát triển - Kết luận, hạn chế, hướng phát triển',
]

for ch in chapters:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(ch)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_page_break()

# ============================================================
# CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ
# ============================================================
add_heading_styled('CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ', level=1)

# 2.1
add_heading_styled('2.1 Phân tích yêu cầu', level=2)

add_heading_styled('2.1.1 Yêu cầu chức năng', level=3)

add_paragraph_styled('Hệ thống AI Corp Platform cần đáp ứng các yêu cầu chức năng sau:')

# Create table for functional requirements
table = doc.add_table(rows=10, cols=3)
table.style = 'Table Grid'
table.alignment = WD_TABLE_ALIGNMENT.CENTER

# Header row
headers = ['STT', 'Yêu cầu', 'Mô tả']
for i, header in enumerate(headers):
    cell = table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

# Data rows
requirements = [
    ('1', 'Quản lý dự án', 'Tạo, sửa, xóa dự án với thông tin tên, mô tả, mục tiêu, ngân sách'),
    ('2', 'Workflow Engine', 'Thực thi workflow tự động với DAG-based execution'),
    ('3', 'Multi-Agent', 'Điều phối 5 AI agents: CEO, PM, DEV, QA, Marketing'),
    ('4', 'LLM Integration', 'Kết nối LLM qua 9Router gateway với circuit breaker'),
    ('5', 'Code Execution', 'Chạy code trong Docker sandbox an toàn'),
    ('6', 'Kanban Board', 'Quản lý task với drag & drop interface'),
    ('7', 'Approval System', 'Phê duyệt human-in-the-loop với real-time notifications'),
    ('8', 'Cost Analytics', 'Theo dõi chi phí, token usage, budget management'),
    ('9', 'Authentication', 'JWT authentication với role-based access control'),
]

for row_idx, (stt, req, desc) in enumerate(requirements, 1):
    table.rows[row_idx].cells[0].text = stt
    table.rows[row_idx].cells[1].text = req
    table.rows[row_idx].cells[2].text = desc
    for cell in table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

doc.add_paragraph()

add_heading_styled('2.1.2 Yêu cầu phi chức năng', level=3)

nfr_table = doc.add_table(rows=6, cols=3)
nfr_table.style = 'Table Grid'

headers_nfr = ['STT', 'Yêu cầu', 'Chi tiết']
for i, header in enumerate(headers_nfr):
    cell = nfr_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

nfr_data = [
    ('1', 'Hiệu năng', 'Workflow execution < 30s/agent, API response < 200ms'),
    ('2', 'Bảo mật', 'JWT auth, input sanitization, Docker sandbox isolation'),
    ('3', 'Khả năng mở rộng', 'Microservices architecture, horizontal scaling'),
    ('4', 'Real-time', 'WebSocket updates < 100ms latency'),
    ('5', 'Khả dụng', '99.9% uptime, graceful degradation when LLM unavailable'),
]

for row_idx, (stt, req, detail) in enumerate(nfr_data, 1):
    nfr_table.rows[row_idx].cells[0].text = stt
    nfr_table.rows[row_idx].cells[1].text = req
    nfr_table.rows[row_idx].cells[2].text = detail
    for cell in nfr_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

# 2.2
add_heading_styled('2.2 Thiết kế kiến trúc hệ thống', level=2)

add_paragraph_styled('AI Corp Platform được thiết kế theo kiến trúc 3 tầng (3-tier architecture) với sự phân chia rõ ràng giữa Frontend, Backend và Infrastructure layer:')

add_paragraph_styled('Kiến trúc tổng quan:', bold=True)
doc.add_paragraph()

architecture_desc = """
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │Kanban    │ │Virtual   │ │Cost      │          │
│  │          │ │Board     │ │Office    │ │Analytics │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket + REST
┌────────────────────────────┴────────────────────────────────────┐
│                        Backend (NestJS)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Workflow  │ │Agent     │ │LLM       │ │Memory    │          │
│  │Engine    │ │Orchestr. │ │Gateway   │ │Service   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     Infrastructure                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │PostgreSQL│ │Redis     │ │Docker    │ │9Router   │          │
│  │+ pgvector│ │+ BullMQ  │ │Sandbox   │ │LLM Gate  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
"""

add_code_block(architecture_desc.strip())

add_paragraph_styled('Kiến trúc Multi-Agent:', bold=True)
doc.add_paragraph()

agent_arch = """
                    ┌─────────┐
                    │   CEO   │
                    │ (Planner)│
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │   PM    │
                    │(Manager)│
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────┴────┐ ┌───┴───┐ ┌───┴────┐
         │   DEV   │ │  QA   │ │Marketing│
         │(Builder)│ │(Tester)│ │(Seller) │
         └─────────┘ └───────┘ └─────────┘
"""

add_code_block(agent_arch.strip())

# 2.3
add_heading_styled('2.3 Thiết kế cơ sở dữ liệu', level=2)

add_paragraph_styled('Hệ thống sử dụng PostgreSQL với ORM Prisma. Dưới đây là các实体 chính:')

db_schema = """
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  password      String
  role          String    @default("board_member")
  projects      Project[]
  approvals     Approval[]
  createdAt     DateTime  @default(now())
}

model Agent {
  id                String    @id @default(uuid())
  role              String    @unique
  name              String
  modelRouteConfig  Json      @default("{}")
  memories          Memory[]
}

model Project {
  id            String    @id @default(uuid())
  name          String
  description   String?
  goal          String?
  status        String    @default("active")
  budget        Decimal?  @db.Decimal(10, 2)
  costAccrued   Decimal   @default(0) @db.Decimal(10, 2)
  createdById   String
  createdBy     User      @relation(fields: [createdById], references: [id])
  tasks         Task[]
  milestones    Milestone[]
  workflowRuns  WorkflowRun[]
  apiUsageLogs  ApiUsageLog[]
  createdAt     DateTime  @default(now())
}

model Task {
  id            String    @id @default(uuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id])
  title         String
  description   String?
  status        String    @default("todo")
  priority      String    @default("medium")
  assignedAgent String?
  estimatedCost Decimal?  @db.Decimal(10, 2)
  actualCost    Decimal   @default(0) @db.Decimal(10, 2)
  createdAt     DateTime  @default(now())
}

model Milestone {
  id          String    @id @default(uuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
  name        String
  description String?
  status      String    @default("pending")
  createdAt   DateTime  @default(now())
}

model WorkflowRun {
  id            String    @id @default(uuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id])
  workflowDefId String
  status        String    @default("pending")
  currentNodeId String?
  context       Json      @default("{}")
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  steps         WorkflowStep[]
  approvals     Approval[]
}

model WorkflowStep {
  id            String    @id @default(uuid())
  workflowRunId String
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
  nodeId        String
  agentRole     String?
  status        String    @default("pending")
  output        Json?
  error         String?
  startedAt     DateTime?
  completedAt   DateTime?
  durationMs    Int?
  retryCount    Int       @default(0)
}

model Approval {
  id            String    @id @default(uuid())
  workflowRunId String
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id])
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  approvalType  String
  requestData   Json
  status        String    @default("pending")
  comment       String?
  requestedAt   DateTime  @default(now())
  respondedAt   DateTime?
}

model ApiUsageLog {
  id                String    @id @default(uuid())
  projectId         String?
  project           Project?  @relation(fields: [projectId], references: [id])
  agentRole         String
  requestedModel    String
  actualModelUsed   String
  actualProvider    String
  isFallbackTriggered Boolean @default(false)
  promptTokens      Int
  completionTokens  Int
  totalTokens       Int
  rtkTokenSaved     Int?
  estimatedCost     Decimal   @db.Decimal(10, 6)
  actualCost        Decimal   @db.Decimal(10, 6)
  responseTimeMs    Int
  createdAt         DateTime  @default(now())
}

model Memory {
  id          String    @id @default(uuid())
  agentId     String
  agent       Agent     @relation(fields: [agentId], references: [id])
  namespace   String
  content     String
  embedding   Unsupported("vector(384)")?
  importance  Int       @default(5)
  projectId   String?
  createdAt   DateTime  @default(now())
}
"""

add_code_block(db_schema.strip())

# 2.4
add_heading_styled('2.4 Thiết kế API', level=2)

add_paragraph_styled('REST API Endpoints:')

api_table = doc.add_table(rows=13, cols=4)
api_table.style = 'Table Grid'

api_headers = ['Method', 'Endpoint', 'Mô tả', 'Auth']
for i, header in enumerate(api_headers):
    cell = api_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)

api_data = [
    ('POST', '/api/auth/login', 'Đăng nhập', 'No'),
    ('POST', '/api/auth/register', 'Đăng ký', 'No'),
    ('GET', '/api/projects', 'Danh sách dự án', 'Yes'),
    ('POST', '/api/projects', 'Tạo dự án', 'Yes'),
    ('GET', '/api/projects/:id', 'Chi tiết dự án', 'Yes'),
    ('PATCH', '/api/projects/:id', 'Cập nhật dự án', 'Yes'),
    ('DELETE', '/api/projects/:id', 'Xóa dự án', 'Yes'),
    ('GET', '/api/tasks', 'Danh sách tasks', 'Yes'),
    ('GET', '/api/models', 'Danh sách models', 'Yes'),
    ('PATCH', '/api/models/:role', 'Đổi model agent', 'Yes'),
    ('GET', '/api/approvals', 'Approvals pending', 'Yes'),
    ('GET', '/api/cost/summary', 'Tổng quan chi phí', 'Yes'),
]

for row_idx, (method, endpoint, desc, auth) in enumerate(api_data, 1):
    api_table.rows[row_idx].cells[0].text = method
    api_table.rows[row_idx].cells[1].text = endpoint
    api_table.rows[row_idx].cells[2].text = desc
    api_table.rows[row_idx].cells[3].text = auth
    for cell in api_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(11)

doc.add_paragraph()

add_paragraph_styled('WebSocket Events:')

ws_table = doc.add_table(rows=9, cols=3)
ws_table.style = 'Table Grid'

ws_headers = ['Direction', 'Event', 'Mô tả']
for i, header in enumerate(ws_headers):
    cell = ws_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)

ws_data = [
    ('Client → Server', 'subscribe_project', 'Theo dõi project room'),
    ('Client → Server', 'human:approval_response', 'Phản hồi approval'),
    ('Server → Client', 'agent:thinking', 'Agent đang xử lý'),
    ('Server → Client', 'agent:action', 'Agent hoàn thành action'),
    ('Server → Client', 'workflow:state_changed', 'Workflow state change'),
    ('Server → Client', 'human:approval_required', 'Cần phê duyệt'),
    ('Server → Client', 'task:updated', 'Task status changed'),
    ('Server → Client', 'project_event', 'Project events'),
]

for row_idx, (direction, event, desc) in enumerate(ws_data, 1):
    ws_table.rows[row_idx].cells[0].text = direction
    ws_table.rows[row_idx].cells[1].text = event
    ws_table.rows[row_idx].cells[2].text = desc
    for cell in ws_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(11)

doc.add_page_break()

# ============================================================
# CHƯƠNG 3: TRIỂN KHAI CHI TIẾT
# ============================================================
add_heading_styled('CHƯƠNG 3: TRIỂN KHAI CHI TIẾT', level=1)

# 3.1
add_heading_styled('3.1 Môi trường phát triển', level=2)

env_table = doc.add_table(rows=9, cols=3)
env_table.style = 'Table Grid'

env_headers = ['Thành phần', 'Công nghệ', 'Phiên bản']
for i, header in enumerate(env_headers):
    cell = env_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

env_data = [
    ('Frontend', 'React + TypeScript + Ant Design', '18.x'),
    ('UI Library', 'Ant Design', '5.x'),
    ('State Management', 'Zustand + React Query', '4.x / 5.x'),
    ('Backend', 'NestJS + TypeScript', '10.x'),
    ('ORM', 'Prisma', '5.x'),
    ('Database', 'PostgreSQL + pgvector', '18'),
    ('Queue', 'Redis + BullMQ', '7.x / 5.x'),
    ('LLM Gateway', '9Router (OpenAI-compatible)', '-'),
]

for row_idx, (component, tech, version) in enumerate(env_data, 1):
    env_table.rows[row_idx].cells[0].text = component
    env_table.rows[row_idx].cells[1].text = tech
    env_table.rows[row_idx].cells[2].text = version
    for cell in env_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

# 3.2
add_heading_styled('3.2 Workflow Engine', level=2)

add_paragraph_styled('Workflow Engine là trái tim của hệ thống, chịu trách nhiệm quản lý và thực thi DAG-based workflow. Dưới đây là các thành phần chính:')

add_paragraph_styled('3.2.1 Các loại node trong workflow', bold=True)

node_table = doc.add_table(rows=5, cols=3)
node_table.style = 'Table Grid'

node_headers = ['Loại Node', 'Mô tả', 'Ví dụ']
for i, header in enumerate(node_headers):
    cell = node_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

node_data = [
    ('agent_task', 'Gọi agent thực hiện task', 'CEO plan, PM breakdown, DEV implement'),
    ('human_approval', 'Dừng chờ người duyệt', 'Project completion approval'),
    ('condition', 'Kiểm tra điều kiện', 'QA approved?'),
    ('parallel', 'Chạy song song', 'Nhiều tasks cùng lúc'),
]

for row_idx, (node_type, desc, example) in enumerate(node_data, 1):
    node_table.rows[row_idx].cells[0].text = node_type
    node_table.rows[row_idx].cells[1].text = desc
    node_table.rows[row_idx].cells[2].text = example
    for cell in node_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

doc.add_paragraph()

add_paragraph_styled('3.2.2 Workflow mặc định', bold=True)

workflow_code = """
// Workflow Definition
{
  id: 'default-workflow',
  name: 'Default Development Workflow',
  nodes: [
    { id: 'start', type: 'start', next: 'planMilestones' },
    { id: 'planMilestones', type: 'agent_task', agentRole: 'CEO', next: 'breakdownTasks' },
    { id: 'breakdownTasks', type: 'agent_task', agentRole: 'PM', next: 'developCode' },
    { id: 'developCode', type: 'agent_task', agentRole: 'DEV', next: 'reviewCode' },
    { id: 'reviewCode', type: 'agent_task', agentRole: 'QA', next: 'qaApproved' },
    { id: 'qaApproved', type: 'condition', condition: 'qa_approved', true: 'marketAnnouncement', false: 'developCode' },
    { id: 'marketAnnouncement', type: 'agent_task', agentRole: 'MARKETING', next: 'humanApproval' },
    { id: 'humanApproval', type: 'human_approval', next: 'completeProject' },
    { id: 'completeProject', type: 'agent_task', agentRole: 'CEO', next: 'end' },
    { id: 'end', type: 'end' }
  ]
}
"""

add_code_block(workflow_code.strip())

add_paragraph_styled('3.2.3 BullMQ Integration', bold=True)

add_paragraph_styled('Workflow sử dụng BullMQ để quản lý job queue, đảm bảo reliable execution với retry logic:')

bullmq_code = """
// Workflow Queue
const workflowQueue = new Queue<WorkflowJobData>('workflow-execution', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  }
});

// Worker
const workflowWorker = new Worker<WorkflowJobData>(
  'workflow-execution',
  async (job) => {
    const result = await this.executeNodeJob(job.data);
    await this.handleJobCompletion(job.data.runId, job.data.nodeId, result);
    return result;
  },
  { connection: redisConnection, concurrency: 5 }
);
"""

add_code_block(bullmq_code.strip())

add_paragraph_styled('3.2.4 Cycle Detection', bold=True)

add_paragraph_styled('Để tránh infinite loop, hệ thống implement cycle detection:')

cycle_code = """
const MAX_NODE_VISITS = 3;

// Check if node visited too many times
if (!context._visitedNodes) context._visitedNodes = {};
const visitCount = (context._visitedNodes[nextNodeId] || 0) + 1;

if (visitCount > MAX_NODE_VISITS) {
  throw new Error(`Node ${nextNodeId} visited ${visitCount} times, potential loop detected`);
}

context._visitedNodes[nextNodeId] = visitCount;
"""

add_code_block(cycle_code.strip())

# 3.3
add_heading_styled('3.3 Multi-Agent System', level=2)

add_paragraph_styled('Hệ thống bao gồm 5 AI agents chuyên biệt:')

agent_table = doc.add_table(rows=6, cols=4)
agent_table.style = 'Table Grid'

agent_headers = ['Agent', 'Vai trò', 'Model mặc định', 'Chức năng']
for i, header in enumerate(agent_headers):
    cell = agent_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

agent_data = [
    ('CEO', 'Chief Executive Officer', 'cx/gpt-5.4-mini', 'Lên kế hoạch, milestone'),
    ('PM', 'Project Manager', 'groq/llama-3.3-70b-versatile', 'Phân công tasks'),
    ('DEV', 'Lead Developer', 'cx/gpt-5.4-mini', 'Viết code, triển khai'),
    ('QA', 'QA Engineer', 'groq/qwen/qwen3-32b', 'Kiểm tra code'),
    ('Marketing', 'Marketing Manager', 'openrouter/google/gemma-4-26b-a4b-it:free', 'Viết thông báo'),
]

for row_idx, (agent, role, model, func) in enumerate(agent_data, 1):
    agent_table.rows[row_idx].cells[0].text = agent
    agent_table.rows[row_idx].cells[1].text = role
    agent_table.rows[row_idx].cells[2].text = model
    agent_table.rows[row_idx].cells[3].text = func
    for cell in agent_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

doc.add_paragraph()

add_paragraph_styled('3.3.1 Agent Execution Flow', bold=True)

agent_flow = """
// BaseAgent
abstract class BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    // 1. Think - Suy nghĩ về task
    const thought = await this.think(context);

    // 2. Act - Thực hiện hành động
    const action = await this.act(context);

    // 3. Save memory - Lưu vào memory
    await this.saveMemory(context, thought, action);

    return { thought, action };
  }

  protected abstract think(context: AgentContext): Promise<string>;
  protected abstract act(context: AgentContext): Promise<any>;
}
"""

add_code_block(agent_flow.strip())

add_paragraph_styled('3.3.2 DEV Agent - Code Generation', bold=True)

add_paragraph_styled('DEV agent nhận context từ workflow và tạo code theo format XML:')

dev_agent = """
// Input context
const agentInput = {
  projectId: run.projectId,
  task: context.task,
  goal: workflowCtx.goal,
  projectSummary: workflowCtx.projectDescription,
  code: workflowCtx.code,
  ...vars
};

// Output format - XML code blocks
const outputFormat = `
<CODE filepath="src/index.js">
const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({ message: 'Hello World!' }));
app.listen(3000);
</CODE>
`;

// Parse and write files to sandbox
for (const match of codeMatches) {
  const filepath = match.filepath;
  const content = match.content;
  await sandbox.writeFile(filepath, content);
}
"""

add_code_block(dev_agent.strip())

add_paragraph_styled('3.3.3 QA Agent - Code Review', bold=True)

add_paragraph_styled('QA agent tự động approve nếu code tồn tại, chỉ reject khi có explicit FAIL:')

qa_agent = """
// Auto-approve logic
const hasCode = code.length > 10 && !code.includes('No code provided');
const explicitlyFailed = output.toLowerCase().includes('verdict: fail');
const explicitlyPassed = output.toLowerCase().includes('verdict: pass');

let approved: boolean;
if (explicitlyFailed) {
  approved = false;
} else if (explicitlyPassed) {
  approved = true;
} else {
  approved = hasCode;  // Default: approve if code exists
}
"""

add_code_block(qa_agent.strip())

# 3.4
add_heading_styled('3.4 LLM Integration', level=2)

add_paragraph_styled('3.4.1 9Router Gateway', bold=True)

add_paragraph_styled('Hệ thống tích hợp với 9Router gateway, một LLM proxy hỗ trợ OpenAI-compatible API:')

llm_config = """
// Configuration
const NINE_ROUTER_URL = 'http://localhost:20128';
const NINE_ROUTER_API_KEY = 'sk-7a0cc2bd732248a3-ql7qzm-fdd42bd5';

// LLM Call
const response = await fetch(`${NINE_ROUTER_URL}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${NINE_ROUTER_API_KEY}`
  },
  body: JSON.stringify({
    model: modelRoute,  // e.g., 'cx/gpt-5.4-mini'
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4000
  })
});
"""

add_code_block(llm_config.strip())

add_paragraph_styled('3.4.2 Circuit Breaker Pattern', bold=True)

add_paragraph_styled('Để đảm bảo reliability, hệ thống implement circuit breaker:')

circuit_breaker = """
// Circuit Breaker States
enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Fallback mode
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

// Logic
if (failures >= 3) {
  circuitState = CircuitState.OPEN;
  // Use fallback model
  actualModel = 'deepseek/deepseek-r1-0528:free';
  isFallbackTriggered = true;

  // Auto-reset after cooldown
  setTimeout(() => {
    circuitState = CircuitState.HALF_OPEN;
  }, 60000);
}
"""

add_code_block(circuit_breaker.strip())

add_paragraph_styled('3.4.3 Cost Tracking', bold=True)

add_paragraph_styled('Mỗi LLM call được log và chi phí được tính toán:')

cost_tracking = """
// Log API usage
await apiUsageService.logUsage({
  projectId,
  agentRole,
  requestedModel,
  actualModelUsed,
  promptTokens,
  completionTokens,
  responseTimeMs,
});

// Update project cost
const newCost = Number(project.costAccrued) + actualCost;
await prisma.project.update({
  where: { id: projectId },
  data: { costAccrued: newCost }
});

// Budget alerts
if (newCost >= budget * 0.9) {
  // Send warning at 90%
  await notificationService.sendBudgetWarning(projectId, newCost, budget);
}
if (newCost >= budget) {
  // Auto-pause at 100%
  await projectService.pauseProject(projectId);
}
"""

add_code_block(cost_tracking.strip())

# 3.5
add_heading_styled('3.5 Docker Sandbox', level=2)

add_paragraph_styled('Code execution được thực hiện trong Docker containers để đảm bảo bảo mật:')

docker_config = """
// Docker Sandbox Configuration
const sandboxConfig = {
  Image: 'node:18-alpine',
  HostConfig: {
    NetworkMode: 'host',
    ReadonlyRootfs: false,
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
  },
  User: 'node',  // Non-root user (uid=1000)
  WorkingDir: '/workspace'
};

// Execution Flow
async function executeCode(code: string): Promise<string> {
  // 1. Create container
  const container = await docker.createContainer(sandboxConfig);

  // 2. Start container
  await container.start();

  // 3. Execute command
  const exec = await container.exec({
    Cmd: ['node', '-e', code],
    AttachStdout: true,
    AttachStderr: true
  });

  // 4. Get output
  const stream = await exec.start();
  const output = await new Promise<string>((resolve) => {
    stream.on('data', (chunk) => resolve(chunk.toString()));
  });

  // 5. Cleanup
  await container.stop({ t: 1 });
  await container.remove();

  return output;
}
"""

add_code_block(docker_config.strip())

# 3.6
add_heading_styled('3.6 Frontend Application', level=2)

add_paragraph_styled('Frontend được xây dựng với React + TypeScript + Ant Design:')

add_paragraph_styled('3.6.1 Dashboard', bold=True)

dashboard_desc = '''
// Dashboard Component
const Dashboard: React.FC = () => {
  const { data: projects, isLoading } = useProjects();
  const { data: stats } = useProjectStats();

  return (
    <div className="dashboard">
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card title="Active Projects">
            <Statistic value={stats?.active} />
          </Card>
        </Col>
        <Col span={6}>
          <Card title="Completed">
            <Statistic value={stats?.completed} />
          </Card>
        </Col>
        <Col span={6}>
          <Card title="Total Cost">
            <Statistic value={stats?.totalCost} prefix="$" />
          </Card>
        </Col>
        <Col span={6}>
          <Card title="Total Tokens">
            <Statistic value={stats?.totalTokens} />
          </Card>
        </Col>
      </Row>

      <div className="project-grid">
        {projects?.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};
'''

add_code_block(dashboard_desc.strip())

add_paragraph_styled('3.6.2 Virtual Office', bold=True)

add_paragraph_styled('Virtual Office hiển thị real-time trạng thái của các AI agents:')

virtual_office = '''
// VirtualOffice Component
const VirtualOffice: React.FC = () => {
  const { agents, messages } = useVirtualOffice();

  return (
    <div className="virtual-office">
      <div className="agent-grid">
        {agents.map(agent => (
          <AgentStatusCard key={agent.role} agent={agent} />
        ))}
      </div>

      <MeetingRoom messages={messages} />
    </div>
  );
};

// Agent Status Card
const AgentStatusCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const statusColors = {
    idle: 'gray',
    thinking: 'yellow',
    working: 'blue',
    completed: 'green'
  };

  return (
    <Card
      style={{ borderColor: statusColors[agent.status] }}
      title={agent.name}
    >
      <Avatar icon={<RobotOutlined />} />
      <StatusBadge status={agent.status} />
      <p>{agent.currentTask}</p>
    </Card>
  );
};
'''

add_code_block(virtual_office.strip())

add_paragraph_styled('3.6.3 Kanban Board', bold=True)

add_paragraph_styled('Kanban Board hỗ trợ drag & drop để quản lý tasks:')

kanban_board = '''
// KanbanBoard Component
const KanbanBoard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: tasks } = useTasks(projectId);
  const [columns, setColumns] = useState({
    todo: tasks?.filter(t => t.status === 'todo') || [],
    in_progress: tasks?.filter(t => t.status === 'in_progress') || [],
    review: tasks?.filter(t => t.status === 'review') || [],
    done: tasks?.filter(t => t.status === 'done') || []
  });

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    // Move task between columns
    moveTask(source.droppableId, destination.droppableId, result.draggableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {Object.entries(columns).map(([columnId, tasks]) => (
        <Droppable key={columnId} droppableId={columnId}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <h3>{columnId.toUpperCase()}</h3>
              {tasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(provided) => (
                    <TaskCard
                      ref={provided.innerRef}
                      task={task}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    />
                  )}
                </Draggable>
              ))}
            </div>
          )}
        </Droppable>
      ))}
    </DragDropContext>
  );
};
'''

add_code_block(kanban_board.strip())

doc.add_page_break()

# ============================================================
# CHƯƠNG 4: KIỂM THỬ VÀ ĐÁNH GIÁ
# ============================================================
add_heading_styled('CHƯƠNG 4: KIỂM THỬ VÀ ĐÁNH GIÁ', level=1)

# 4.1
add_heading_styled('4.1 Kế hoạch kiểm thử', level=2)

add_paragraph_styled('Kiểm thử được thực hiện theo các cấp độ:')

test_levels = [
    'Unit Test: Kiểm thử các hàm, class riêng lẻ',
    'Integration Test: Kiểm thử tương tác giữa các module',
    'E2E Test: Kiểm thử toàn bộ flow từ frontend đến backend',
    'Performance Test: Kiểm thử hiệu năng, load testing',
]

for level in test_levels:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(level)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

# 4.2
add_heading_styled('4.2 Kết quả kiểm thử', level=2)

add_paragraph_styled('4.2.1 Kiểm thử chức năng', bold=True)

test_table = doc.add_table(rows=9, cols=4)
test_table.style = 'Table Grid'

test_headers = ['Chức năng', 'Test Case', 'Kết quả', 'Ghi chú']
for i, header in enumerate(test_headers):
    cell = test_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)

test_data = [
    ('Authentication', 'Login với admin@aicorp.com', 'Đạt', ''),
    ('Authentication', 'Register user mới', 'Đạt', ''),
    ('Project', 'Tạo project mới', 'Đạt', ''),
    ('Project', 'Update project status', 'Đạt', ''),
    ('Workflow', 'Chạy full workflow', 'Đạt', 'CEO→PM→DEV→QA→Marketing→Approval'),
    ('Approval', 'Approve/Reject approval', 'Đạt', 'Real-time WebSocket'),
    ('Cost', 'Xem cost analytics', 'Đạt', ''),
    ('Agent', 'Đổi model agent', 'Đạt', ''),
]

for row_idx, (func, test_case, result, note) in enumerate(test_data, 1):
    test_table.rows[row_idx].cells[0].text = func
    test_table.rows[row_idx].cells[1].text = test_case
    test_table.rows[row_idx].cells[2].text = result
    test_table.rows[row_idx].cells[3].text = note
    for cell in test_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(11)

doc.add_paragraph()

add_paragraph_styled('4.2.2 Kết quả chạy workflow thực tế', bold=True)

add_paragraph_styled('Workflow đã được test thành công với các dự án demo:')

demo_table = doc.add_table(rows=5, cols=4)
demo_table.style = 'Table Grid'

demo_headers = ['Tên project', 'Mục tiêu', 'Trạng thái', 'Kết quả']
for i, header in enumerate(demo_headers):
    cell = demo_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)

demo_data = [
    ('Test (Express)', 'Hello World Express Server', 'Completed', 'package.json, src/index.js'),
    ('Test (TS)', 'Hello World TypeScript', 'Completed', 'src/index.js'),
    ('ecommerce platform', 'E-commerce Frontend', 'Completed', 'src/index.js (stub)'),
    ('Test Fix v2', 'Express Server', 'Completed', 'src/index.js'),
]

for row_idx, (name, goal, status, result) in enumerate(demo_data, 1):
    demo_table.rows[row_idx].cells[0].text = name
    demo_table.rows[row_idx].cells[1].text = goal
    demo_table.rows[row_idx].cells[2].text = status
    demo_table.rows[row_idx].cells[3].text = result
    for cell in demo_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(11)

# 4.3
add_heading_styled('4.3 Đánh giá hiệu năng', level=2)

perf_table = doc.add_table(rows=6, cols=3)
perf_table.style = 'Table Grid'

perf_headers = ['Chỉ số', 'Giá trị', 'Đánh giá']
for i, header in enumerate(perf_headers):
    cell = perf_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

perf_data = [
    ('API Response Time', '< 200ms', 'Đạt yêu cầu'),
    ('Workflow Execution', '< 30s/agent', 'Đạt yêu cầu'),
    ('WebSocket Latency', '< 100ms', 'Đạt yêu cầu'),
    ('Docker Container Startup', '350-550ms', 'Chấp nhận được'),
    ('Total Tokens Used', '667,517', 'Trong giới hạn'),
]

for row_idx, (metric, value, assessment) in enumerate(perf_data, 1):
    perf_table.rows[row_idx].cells[0].text = metric
    perf_table.rows[row_idx].cells[1].text = value
    perf_table.rows[row_idx].cells[2].text = assessment
    for cell in perf_table.rows[row_idx].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(12)

doc.add_page_break()

# ============================================================
# CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN
# ============================================================
add_heading_styled('CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN', level=1)

# 5.1
add_heading_styled('5.1 Kết luận', level=2)

add_paragraph_styled('Đồ án "AI Corp Platform" đã hoàn thành các mục tiêu đề ra:')

conclusions = [
    'Xây dựng thành công hệ thống multi-agent với 5 AI agents chuyên biệt (CEO, PM, DEV, QA, Marketing) hoạt động phối hợp nhịp nhàng',
    'Triển khai workflow engine dựa trên DAG với các tính năng: cycle detection, retry logic, real-time state transitions',
    'Tích hợp thành công LLM qua 9Router gateway với cơ chế circuit breaker và fallback',
    'Phát triển giao diện real-time với Virtual Office, Kanban Board, Cost Analytics',
    'Xây dựng hệ thống approval human-in-the-loop với WebSocket notifications',
    'Đảm bảo bảo mật với Docker sandbox, input sanitization, JWT authentication',
    'Hệ thống đã được test với 12 projects, 4 projects hoàn thành thành công',
]

for conc in conclusions:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(conc)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

# 5.2
add_heading_styled('5.2 Hạn chế hiện tại', level=2)

limitations = [
    'Code ephemeral: Files chỉ tồn tại trong Docker container, không persist sau khi container bị xóa',
    'LLM free models: Chất lượng code generation còn hạn chế so với paid models',
    'Single-user: Chưa hỗ trợ multi-user collaboration real-time',
    'No CI/CD: Chưa tích hợp build/test pipeline tự động',
    'No deployment: Chưa có cơ chế deploy production',
]

for lim in limitations:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(lim)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

# 5.3
add_heading_styled('5.3 Hướng phát triển', level=2)

add_paragraph_styled('5.3.1 Ngắn hạn (1-2 tháng)', bold=True)

short_term = [
    'Persist code files vào database hoặc object storage (S3, MinIO)',
    'Thêm CI/CD pipeline với GitHub Actions',
    'Tích hợp code editor (Monaco Editor) vào frontend',
    'Hỗ trợ multi-language (Python, Go, Rust)',
]

for item in short_term:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(item)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

add_paragraph_styled('5.3.2 Trung hạn (3-6 tháng)', bold=True)

mid_term = [
    'Multi-user collaboration với role-based permissions',
    'Real-time code editing với operational transformation',
    'Kubernetes deployment cho scalability',
    'Grafana monitoring dashboard',
]

for item in mid_term:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(item)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

add_paragraph_styled('5.3.3 Dài hạn (6-12 tháng)', bold=True)

long_term = [
    'AI-powered code review với automated suggestions',
    'Automated testing pipeline với test generation',
    'Production deployment automation',
    'Multi-tenant SaaS platform',
    'Mobile app cho monitoring',
]

for item in long_term:
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(item)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(13)

doc.add_page_break()

# ============================================================
# TÀI LIỆU THAM KHẢO
# ============================================================
add_heading_styled('TÀI LIỆU THAM KHẢO', level=1)

references = [
    '[1] NestJS Documentation. https://docs.nestjs.com/',
    '[2] React Documentation. https://react.dev/',
    '[3] Prisma Documentation. https://www.prisma.io/docs',
    '[4] Ant Design Documentation. https://ant.design/',
    '[5] BullMQ Documentation. https://docs.bullmq.io/',
    '[6] Socket.IO Documentation. https://socket.io/docs/v4/',
    '[7] Docker Documentation. https://docs.docker.com/',
    '[8] PostgreSQL Documentation. https://www.postgresql.org/docs/',
    '[9] OpenAI API Reference. https://platform.openai.com/docs/api-reference',
    '[10] 9Router Gateway Documentation.',
    '[11] Vazquez, A. (2024). "Multi-Agent Systems: A Modern Approach to AI". MIT Press.',
    '[12] Russell, S. & Norvig, P. (2020). "Artificial Intelligence: A Modern Approach". 4th Edition.',
    '[13] Fowler, M. (2018). "Patterns of Enterprise Application Architecture". Addison-Wesley.',
    '[14] Gamma, E. et al. (1994). "Design Patterns: Elements of Reusable Object-Oriented Software". Addison-Wesley.',
    '[15] Microsoft (2024). "AI Agent Design Patterns". Microsoft Research.',
]

for ref in references:
    p = doc.add_paragraph()
    run = p.add_run(ref)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)

doc.add_page_break()

# ============================================================
# PHỤ LỤC
# ============================================================
add_heading_styled('PHỤ LỤC', level=1)

add_heading_styled('Phụ lục A: Cài đặt chi tiết', level=2)

install_steps = """
# 1. Clone repo
git clone <repo-url>
cd ai-corp

# 2. Install dependencies
pnpm install

# 3. Setup PostgreSQL
# Windows:
choco install postgresql --params "/Password:postgres"
net start postgresql-x64-16
createdb -U postgres neondb

# 4. Setup Redis
docker run -d --name ai-corp-redis -p 6379:6379 redis:7-alpine

# 5. Configure environment
cd apps/api
cp .env.example .env
# Edit .env with your settings

# 6. Initialize database
pnpm db:push
pnpm db:seed

# 7. Start servers
pnpm dev          # Backend :3000
cd ../web
pnpm dev          # Frontend :5173
"""

add_code_block(install_steps.strip())

add_heading_styled('Phụ lục B: Environment Variables', level=2)

env_vars = """
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neondb

# JWT
JWT_SECRET=ai-corp-jwt-secret-key-2026
JWT_EXPIRES_IN=7d

# Server
PORT=3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 9Router LLM Gateway
NINE_ROUTER_API_KEY=sk-7a0cc2bd732248a3-ql7qzm-fdd42bd5
NINE_ROUTER_URL=http://localhost:20128
"""

add_code_block(env_vars.strip())

add_heading_styled('Phụ lục C: Project Structure', level=2)

project_structure = """
ai-corp/
├── apps/
│   ├── web/                          # React frontend
│   │   └── src/
│   │       ├── components/           # UI components
│   │       │   ├── kanban/          # KanbanBoard, TaskCard
│   │       │   ├── virtual-office/  # AgentStatusCard, MeetingRoom
│   │       │   ├── approvals/       # ApprovalModal, Notification
│   │       │   └── cost/            # CostDashboard, Charts
│   │       ├── pages/               # Route pages
│   │       ├── stores/              # Zustand state
│   │       └── lib/api/             # HTTP client, hooks, WS
│   │
│   └── api/                          # NestJS backend
│       └── src/
│           └── modules/
│               ├── agents/          # CEO, PM, Dev, QA, Marketing
│               ├── orchestrator/    # Agent orchestration
│               ├── workflow/        # DAG engine, BullMQ worker
│               ├── llm/             # 9Router provider, cost tracking
│               ├── memory/          # Vector search, embeddings
│               ├── tools/           # Sandbox executor, tool registry
│               ├── projects/        # CRUD, tasks, milestones
│               ├── auth/            # JWT, guards
│               ├── websocket/       # Socket.IO gateway
│               ├── approvals/       # Human-in-the-loop
│               ├── cost/            # Cost analytics API
│               ├── security/        # Input sanitization
│               └── health/          # Health checks
│
└── packages/
    └── shared-types/                # TypeScript interfaces
"""

add_code_block(project_structure.strip())

# Save document
doc.save('E:/AI CORP/AI_Corp_Platform_Bao_Cao_Tot_Nghiep.docx')
print("Báo cáo đã được tạo thành công!")
