# Hướng Dẫn Sử Dung AI Corp Platform

Hướng dẫn chi tiết cách sử dụng AI Corp Platform.

---

## Mục Lục

1. [Bắt Đầu](#1-bắt-đầu)
2. [Đăng Nhập](#2-đăng-nhập)
3. [Tạo Dự Án](#3-tạo-dự-án)
4. [Quản Lý Dự Án](#4-quản-lý-dự-án)
5. [Theo Dõi AI Agents](#5-theo-dõi-ai-agents)
6. [Duyệt Approval](#6-duyệt-approval)
7. [Theo Dõi Chi Phí](#7-theo-dõi-chi-phí)
8. [Cấu Hình Hệ Thống](#8-cấu-hình-hệ-thống)
9. [Xử Lý Sự Cố](#9-xử-lý-sự-cố)

---

## 1. Bắt Đầu

### Yêu Cầu

- Node.js 18+
- pnpm 8+
- Docker Desktop
- PostgreSQL 18

### Cài Đặt

```bash
# Clone và cài đặt
git clone <repo-url>
cd ai-corp
pnpm install

# Cấu hình database
cd apps/api
cp .env.example .env
# Chỉnh sửa .env với DATABASE_URL phù hợp

# Khởi tạo database
pnpm db:push
pnpm db:seed    # Tạo admin@aicorp.com / admin123

# Khởi động Redis
docker run -d --name ai-corp-redis -p 6379:6379 redis:7-alpine

# Khởi động backend
pnpm dev        # Backend :3000

# Khởi động frontend (terminal mới)
cd ../web
pnpm dev        # Frontend :5173
```

Mở trình duyệt tại: **http://localhost:5173**

---

## 2. Đăng Nhập

### Đăng Nhập

1. Mở `http://localhost:5173`
2. Nhập thông tin:
   - **Email**: `admin@aicorp.com`
   - **Mật khẩu**: `admin123`
3. Click **Đăng Nhập**
4. Token JWT được lưu tự động, chuyển sang Dashboard

### Đăng Ký Tài Khoản Mới

1. Mở `http://localhost:5173/auth`
2. Chọn tab **Đăng Ký**
3. Nhập thông tin và click **Đăng Ký**

### Phân Quyền

| Vai Trò | Mô Tả |
|---------|-------|
| `admin` | Quản trị viên, đầy đủ quyền |
| `board_member` | Xem dự án, duyệt approval, theo dõi chi phí |

---

## 3. Tạo Dự Án Mới

### Qua Giao Diện

1. Truy cập **Dashboard** (trang chủ)
2. Click nút **"+ Tạo Dự Án Mới"**
3. Điền thông tin:

| Trường | Mô Tả | Ví Dụ |
|--------|-------|-------|
| **Tên dự án** | Tên ngắn gọn | "Hello World Express Server" |
| **Mô tả** | Mô tả chi tiết | "Tạo server Express đơn giản với GET /" |
| **Mục tiêu** | Goal của dự án | "Create a simple hello world Express server" |
| **Ngân sách** (tùy chọn) | Số tiền tối đa (USD) | 50.00 |

4. Click **Tạo**

### Workflow Tự Động

Sau khi tạo dự án, workflow tự động chạy:

```
CEO (Lên kế hoạch) → PM (Phân công) → Dev (Làm việc) → QA (Kiểm tra) → Marketing (Quảng cáo) → Duyệt
```

Theo dõi tiến độ tại **Virtual Office**.

---

## 4. Quản Lý Dự Án

### Xem Chi Tiết Dự Án

Click vào thẻ dự án trên Dashboard để xem:

| Tab | Nội Dung |
|-----|----------|
| **Project Output** | Kết quả hoàn thành, code đã viết, files |
| **Kanban Board** | Danh sách công việc theo trạng thái |
| **Milestones** | Các cột mốc của dự án |
| **Workflow Runs** | Lịch sử chạy workflow |

### Kanban Board

| Cột | Mô Tả |
|-----|-------|
| **Todo** | Chưa bắt đầu |
| **In Progress** | Đang làm |
| **Review** | Đang kiểm tra |
| **Done** | Hoàn thành |

Kéo thả task giữa các cột để thay đổi trạng thái.

### Tạm Dừng / Tiếp Tục

1. Vào chi tiết dự án
2. Click **"Tạm Dừng"** hoặc **"Tiếp Tục"**
3. Workflow sẽ dừng hoặc chạy tiếp

### Xóa Dự Án

1. Vào chi tiết dự án
2. Click **"Xóa"**
3. Xác nhận xóa

---

## 5. Theo Dõi AI Agents

### Virtual Office

Truy cập **Virtual Office** để xem agents đang hoạt động:

| Agent | Vị Trí | Chức Năng |
|-------|--------|-----------|
| **CEO** | Phòng Họp | Lên kế hoạch, quản lý dự án |
| **PM** | Bàn Làm Việc | Phân công công việc |
| **DEV** | Bàn Code | Viết code, test |
| **QA** | Bàn Kiểm Tra | Kiểm tra code |
| **MARKETING** | Phòng Marketing | Viết quảng cáo |

### Trạng Thái Agent

| Màu Sắc | Trạng Thái |
|---------|-----------|
| 🟢 **Xanh lá** | Đang hoạt động |
| 🟡 **Vàng** | Đang suy nghĩ |
| 🔵 **Xanh dương** | Đang làm việc |
| ⚪ **Xám** | Nghỉ |

### Meeting Room

Xem tin nhắn real-time giữa các agent:
- Agent chia se kết quả làm việc
- Cập nhật tiến độ
- Thông báo quan trọng
- Approval requests với nút Duyệt/Từ Chối

---

## 6. Duyệt Approval

### Khi Nào Cần Duyệt?

Workflow dừng và yêu cầu approval khi:
- Dự án hoàn thành, cần phê duyệt cuối cùng
- Ngân sách vượt ngưỡng cho phép
- Quyết định quan trọng cần xác nhận

### Cách Duyệt

#### Qua Meeting Room (Virtual Office)

1. Tin nhắn approval hiện trong Meeting Room với nút **Approve** / **Reject**
2. Click **Approve** để chấp nhận
3. Click **Reject** để từ chối

#### Qua Header Bell Icon

1. Click icon 🔔 trên header
2. Xem danh sách approvals đang chờ
3. Click vào để xem chi tiết
4. Chọn **Approve** hoặc **Reject**

#### Qua Project Detail

1. Vào chi tiết dự án có approval pending
2. Banner vàng hiện ở đầu trang
3. Click **Approve** hoặc **Reject**

---

## 7. Theo Dõi Chi Phí

### Cost Analytics Dashboard

Truy cập **Dashboard** → Xem tổng quan:

| Thống Số | Mô Tả |
|----------|-------|
| **Total Cost** | Tổng chi phí LLM |
| **Total Tokens** | Tổng token đã sử dụng |
| **RTK Saved** | Token tiết kiệm được |
| **Models Used** | Số model đã dùng |

### Biểu Đồ

- **Cost by Agent** - Pie chart chi phí theo agent
- **Token Usage by Agent** - Bar chart token theo agent
- **Model Usage Breakdown** - Bảng chi tiết theo model
- **Cost Over Time** - Line chart chi phí theo thời gian

### Ngân Sách

- Khi chi phí đạt **90% ngân sách** → Cảnh báo
- Khi chi phí **vượt ngân sách** → Tự động tạm dừng dự án

---

## 8. Cấu Hình Hệ Thống

### Agent Models

Đổi model của agent qua giao diện **Agent Models**:

1. Truy cập menu **Agent Models**
2. Chọn agent cần đổi
3. Chọn model mới từ dropdown
4. Click **Save**

### Models Hiện Có

| Agent | Model Mặc Định |
|-------|----------------|
| CEO | `cx/gpt-5.4-mini` |
| PM | `groq/llama-3.3-70b-versatile` |
| DEV | `cx/gpt-5.4-mini` |
| QA | `groq/qwen/qwen3-32b` |
| MARKETING | `openrouter/google/gemma-4-26b-a4b-it:free` |

### Environment Variables

| Biến | Mô Tả | Mặc Định |
|------|-------|----------|
| `DATABASE_URL` | PostgreSQL URL | `postgresql://postgres:postgres@localhost:5432/neondb` |
| `JWT_SECRET` | JWT signing key | `ai-corp-jwt-secret-key-2026` |
| `PORT` | Port backend | `3000` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

### Reset Database

```bash
cd apps/api
pnpm db:push --force-reset
pnpm db:push
pnpm db:seed
```

---

## 9. Xử Lý Sự Cố

### Agent Không Hoạt Động

**Triệu chứng:** Workflow dừng, agent không trả lời

**Giải pháp:**
1. Kiểm tra log backend
2. Kiểm tra 9Router có hoạt động không
3. Kiểm tra API key trong `.env`

### WebSocket Mất Kết Nối

**Triệu chứng:** Không nhận cập nhật real-time

**Giải pháp:**
1. Reload trang
2. Kiểm tra JWT token còn hạn
3. Kiểm tra backend đang chạy

### Database Lỗi

**Triệu chứng:** Lỗi khi truy vấn dữ liệu

**Giải pháp:**
1. Kiểm tra PostgreSQL đang chạy
2. Kiểm tra kết nối: `psql -U postgres -d neondb -c "SELECT 1;"`
3. Reset nếu cần

### Docker Sandbox Lỗi

**Triệu chứng:** DEV agent không viết được file

**Giải pháp:**
1. Kiểm tra Docker Desktop đang chạy
2. Kiểm tra image `node:18-alpine` đã pull
3. Restart Docker daemon

---

## Checklist Nhanh

- [ ] Docker Desktop đang chạy
- [ ] PostgreSQL đang chạy
- [ ] Redis đang chạy (`docker ps | grep ai-corp-redis`)
- [ ] Backend đang chạy (`localhost:3000`)
- [ ] Frontend đang chạy (`localhost:5173`)
- [ ] Có thể đăng nhập với `admin@aicorp.com` / `admin123`
- [ ] Có thể tạo dự án mới
- [ ] Agent hoạt động (xem Virtual Office)

---

## Hỗ Trợ

- Xem [API.md](API.md) cho chi tiết API endpoints
- Xem [README.md](README.md) cho tổng quan dự án
