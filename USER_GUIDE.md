# Huong Dan Su Dung AI Corp Platform

Day la huong dan chi tiet cach su dung AI Corp Platform nhu mot user binh thuong.

---

## Muc Luc

1. [Bat Dau](#1-bat-dau)
2. [Dang Ky va Dang Nhap](#2-dang-ky-va-dang-nhap)
3. [Tao Du An Moi](#3-tao-du-an-moi)
4. [Quan Ly Du An](#4-quan-ly-du-an)
5. [Theo Doi AI Agents](#5-theo-doi-ai-agents)
6. [Duyet Approval](#6-duyet-approval)
7. [Theo Doi Chi Phi](#7-theo-doi-chi-phi)
8. [Doi Provider va Model](#8-doi-provider-va-model)
9. [Cau Hinh He Thong](#9-cau-hinh-he-thong)
10. [Xu Ly Van De](#10-xu-ly-van-de)

---

## 1. Bat Dau

### Yeu Cau

- Node.js 18+
- pnpm 8+
- PostgreSQL (local hoac Neon cloud)

### Cai Dat

```bash
# Clone va cai dat
git clone <repo-url>
cd ai-corp
pnpm install

# Tao file .env
cp apps/api/.env.example apps/api/.env
```

### Cau Hinh PostgreSQL

#### Option 1: PostgreSQL local (Windows)

```bash
# Cai dat qua Chocolatey
choco install postgresql --params "/Password:postgres"

# Khoi dong service
net start postgresql-x64-16

# Tao database
createdb -U postgres neondb
```

#### Option 2: PostgreSQL local (macOS/Linux)

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createdb neondb

# Linux (Ubuntu/Debian)
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb neondb
```

#### Option 3: Docker

```bash
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=neondb \
  postgres:16
```

#### Option 4: Neon Cloud

Dung URL trong file `.env` mac dinh.

### Cau Hinh API Key

Mo file `apps/api/.env` va dien:

```env
# 9Router API key (bat buoc cho LLM)
NINE_ROUTER_API_KEY=sk-7a0cc2bd732248a3-ql7qzm-fdd42bd5

# Database URL
# Local: postgresql://postgres:postgres@localhost:5432/neondb
# Neon: postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neondb

# Redis (optional - server runs in degraded mode if unavailable)
REDIS_URL=redis://localhost:6379
```

### Khoi Dong

```bash
# Khoi dong database (neu chua chay)
net start postgresql-x64-16   # Windows
# hoac: brew services start postgresql@16  # macOS

# Khoi dong backend
cd apps/api
pnpm db:push                  # Dong bo schema
pnpm db:seed                  # Tao admin@aicorp.com / admin123
pnpm dev                      # Backend :3000

# Khoi dong frontend (terminal moi)
cd apps/web
pnpm dev                      # Frontend :5173
```

Mo trinh duyet tai: **http://localhost:5173/auth**

---

## 2. Dang Ky va Dang Nhap

### Dang Nhap

1. Mo trinh duyet tai `http://localhost:5173/auth`
2. Chon tab **Dang Nhap**
3. Nhap thong tin:
   - **Email**: `admin@aicorp.com`
   - **Mat khau**: `admin123`
4. Click **Dang Nhap**
5. Token JWT se duoc luu tu dong, chuyen sang Dashboard

### Dang Ky Tai Khoan Moi

1. Mo trinh duyet tai `http://localhost:5173/auth`
2. Chon tab **Dang Ky**
3. Nhap thong tin:
   - **Email**: email cua ban
   - **Ten**: ten hien thi
   - **Mat khau**: toi thieu 6 ky tu
4. Click **Dang Ky**
5. Sau khi dang ky, quay lai tab Dang Nhap

### Phan Quyen

| Vai Tro | Mo Ta |
|---------|-------|
| `admin` | Quan tri vien, co day du quyen |
| `board_member` | Co the xem du an, duyet approval, theo doi chi phi |

---

## 3. Tao Du An Moi

### Bang Giao Dien

1. Truy cap **Dashboard** (trang chu)
2. Click nut **"+ Tao Du An Moi"**
3. Dien thong tin:

| Truong | Mo Ta | Vi Du |
|--------|-------|-------|
| **Ten du an** | Ten ngan gon | "Website ban hang" |
| **Mo ta** | Mo ta chi tiet | "Xay dung website ban hang hoan chinh" |
| **Muc tieu** | Goal cua du an | "Tao website voi gio hang, thanh toan, quan ly" |
| **Ngan sach** (tuy chon) | So tien toi da (USD) | 50.00 |

4. Click **Tao**

### Workflow Tu Dong

Sau khi tao du an, workflow se tu dong chay:

```
CEO (Ke hoach) → PM (Phan cong) → Dev (Lam viec) → QA (Kiem tra) → Marketing (Quang cao) → Duyet
```

Ban co the theo doi tien do tai trang **Virtual Office**.

---

## 4. Quan Ly Du An

### Xem Chi Tiet Du An

1. Click vao the du an tren Dashboard
2. Xem:
   - Trang thai (Dang hoat dong, Tam dung, Hoan thanh)
   - Danh sach cong viec (Kanban board)
   - Chi phi da chi

### Tam Dung Du An

Neu muon dung tam:
1. Vao chi tiet du an
2. Click **"Tam Dung"**
3. Workflow se dung lai, cac agent se nghi

### Huy Du An

1. Vao chi tiet du an
2. Click **"Huy Du An"**
3. Xac nhan huy

### Kanban Board

Xem va quan ly cong viec:

| Cot | Mo Ta |
|-----|-------|
| **Todo** | Chua bat dau |
| **In Progress** | Dang lam |
| **Review** | Dang kiem tra |
| **Done** | Hoan thanh |

Co the keo tha task giua cac cot de thay doi trang thai.

---

## 5. Theo Doi AI Agents

### Virtual Office

Truy cap **Virtual Office** de xem agent dang lam gi:

| Agent | Vi Tri | Chuc Nang |
|-------|--------|-----------|
| **CEO** | Phong Hop | Lap ke hoach, quan ly du an |
| **PM** | Ban Lam Viec | Phan cong cong viec |
| **DEV** | Ban Code | viet code, test |
| **QA** | Ban Kiem Tra | kiem tra code |
| **MARKETING** | Phong Marketing | viet quang cao |

### Trang Thai Agent

| Mau Sac | Trang Thai |
|---------|-----------|
| **Xanh la** | Dang hoat dong |
| **Vang** | Dang suy nghi |
| **Xanh duong** | Dang lam viec |
| **Xam** | Nghi |

### Meeting Room

Xem cac tin nhan giua cac agent:
- Agent chia se ket qua lam viec
- Cap nhat tien do
- Thong bao quan trong

---

## 6. Duyet Approval

### Khi Nao Can Duyet?

Workflow se dung lai va yeu cau duyet khi:
- Du an hoan thanh
- Co quyet dinh quan trong can xac nhan
- Ngan sach vuot muc cho phep

### Cach Duyet

1. Nhan thong bao **"Approval Required"**
2. Xem chi tiet:
   - Loai approval
   - Noi dung can duyet
   - Boi canh workflow
3. Chon:
   - **Dong Y** → Workflow tiep tuc
   - **Tu Choi** → Workflow chuyen sang trang thai tu choi

---

## 7. Theo Doi Chi Phi

### Dashboard Chi Phi

Truy cap **Dashboard** → Tab **Chi Phi** de xem:

| Thong So | Mo Ta |
|----------|-------|
| **Tong chi phi** | So tien da chi cho LLM |
| **Chi phi theo agent** | Phi tung agent |
| **Token da dung** | So token da su dung |
| **RTK tiet kiem** | Token da tiet kiem duoc (neu dung 9Router) |

### Canh Bao Ngan Sach

- Khi chi phi dat **90% ngan sach** → Thong bao canh bao
- Khi chi phi **vuot ngan sach** → Tu dong tam dung du an

### Xem Log Su Dung

```bash
# Xem log chi tiet
curl http://localhost:3000/health

# Hoa truc tiep tu database
psql -d aicorp -c "SELECT * FROM \"ApiUsageLog\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

---

## 8. Doi Provider va Model

### Hieu Ve Provider

| Provider | Mo Ta | Chi Phi |
|----------|-------|---------|
| **OpenCode** | Free models qua 9Router gateway | Mien phi |
| **9Router** | Gateway thong minh, tu dong route | Re hon |

### Cau Hinh Mac Dinh

Moi agent da duoc cau hinh san voi OpenCode free models:

| Agent | Provider | Model |
|-------|----------|-------|
| CEO | opencode | oc/deepseek-v4-flash-free |
| PM | opencode | oc/big-pickle |
| DEV | opencode | oc/mimo-v2.5-free |
| QA | opencode | oc/north-mini-code-free |
| MARKETING | opencode | oc/nemotron-3-ultra-free |

### Doi Model Cua Agent

#### Cach 1: Sua Truc Tiep Trong Database

```bash
# Dang nhap vao database
psql -U postgres -d neondb

# Xem cau hinh hien tai
SELECT role, "modelRouteConfig" FROM "Agent";

# Doi model cua CEO
UPDATE "Agent"
SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/deepseek-v4-flash-free"}'::jsonb
WHERE role = 'CEO';

# Doi model cua DEV
UPDATE "Agent"
SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/mimo-v2.5-free"}'::jsonb
WHERE role = 'DEV';
```

#### Cach 2: Qua API

```bash
# Cap nhat cau hinh agent
curl -X PATCH http://localhost:3000/api/agents/CEO \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelRouteConfig": {
      "provider": "opencode",
      "model": "oc/deepseek-v4-flash-free"
    }
  }'
```

### Cac Model Co San (OpenCode Free)

| Model | Mo Ta | Phi |
|-------|-------|-----|
| `oc/deepseek-v4-flash-free` | Nhanh, tot cho planning | Mien phi |
| `oc/big-pickle` | Can bang, tot cho PM | Mien phi |
| `oc/mimo-v2.5-free` | Code tot, cho DEV | Mien phi |
| `oc/north-mini-code-free` | Code review, cho QA | Mien phi |
| `oc/nemotron-3-ultra-free` | Marketing, content | Mien phi |

### Goi Y Cau Hinh

**Mac dinh (OpenCode free - khuyen nghi):**
```sql
-- Tat ca dung OpenCode free models
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/deepseek-v4-flash-free"}'::jsonb;
```

**Neu muon tot nhat cho tung agent:**
```sql
-- CEO: DeepSeek (tot cho planning)
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/deepseek-v4-flash-free"}'::jsonb WHERE role = 'CEO';

-- PM: Big Pickle (can bang)
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/big-pickle"}'::jsonb WHERE role = 'PM';

-- DEV: Mimo (code tot)
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/mimo-v2.5-free"}'::jsonb WHERE role = 'DEV';

-- QA: North Mini Code (review)
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/north-mini-code-free"}'::jsonb WHERE role = 'QA';

-- MARKETING: Nemotron (content)
UPDATE "Agent" SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/nemotron-3-ultra-free"}'::jsonb WHERE role = 'MARKETING';
```

### Fallback Provider

Khi OpenCode khong kha dung (het ket noi, loi...), he thong se tu dong fallback sang model khac cung provider.

De thay doi fallback:
```sql
UPDATE "Agent"
SET "modelRouteConfig" = '{"provider": "opencode", "model": "oc/deepseek-v4-flash-free", "fallbackModel": "oc/big-pickle"}'::jsonb
WHERE role = 'DEV';
```

### Kiem Tra Trang Thai He Thong

```bash
# Kiem tra 9Router hoat dong
curl http://localhost:20128/health

# Kiem tra trang thai server
curl http://localhost:3000/api/health
```

---

## 9. Cau Hinh He Thong

### File Environment

| Bien | Mo Ta | Gia Tri Mac Dinh |
|------|-------|-----------------|
| `DATABASE_URL` | PostgreSQL URL | `postgresql://postgres:postgres@localhost:5432/neondb` |
| `NINE_ROUTER_API_KEY` | API key 9Router | - |
| `NINE_ROUTER_URL` | URL 9Router | `http://localhost:20128/v1` |
| `REDIS_URL` | Redis URL (optional) | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing key | mac dinh |
| `PORT` | Port backend | `3000` |

### Doi Port

```env
# apps/api/.env
PORT=4000
```

### Doi Database

```env
# apps/api/.env
DATABASE_URL=postgresql://user:pass@remote-server:5432/neondb
```

### Reset Database

```bash
cd apps/api
pnpm db:push --force-reset
pnpm db:push       # Tao lai schema
pnpm db:seed       # Seed admin + agents
```

---

## 10. Xu Ly Van De

### 9Router Khong Kha Dung

**Trieu chung:** L loi "Connection refused" khi goi LLM

**Giai phap:**
1. Kiem tra 9Router dang chay:
   ```bash
   curl http://localhost:20128/health
   ```
2. Neu khong kha dung, he thong se tu dong fallback sang model khac
3. Kiem tra API key trong `.env`

### Agent Khong Hoat Dong

**Trieu chung:** Workflow dung, agent khong tra loi

**Giai phap:**
1. Kiem tra log backend:
   ```bash
   cd apps/api && pnpm dev
   ```
2. Kiem tra API key con han
3. Kiem tra model con kha dung

### WebSocket Mat Ket Noi

**Trieu chung:** Khong nhan duoc cap nhat real-time

**Giai phap:**
1. Kiem tra ket noi WebSocket:
   ```bash
   curl -i http://localhost:3000/socket.io/?EIO=4
   ```
2. Kiem tra JWT token con han
3. Reload trang

### Database Loi

**Trieu chung:** Loi khi truy van du lieu

**Giai phap:**
1. Kiem tra PostgreSQL dang chay:
   ```bash
   # Windows
   net start postgresql-x64-16
   
   # macOS
   brew services start postgresql@16
   
   # Linux
   sudo systemctl start postgresql
   ```
2. Kiem tra ket noi:
   ```bash
   psql -U postgres -d neondb -c "SELECT 1;"
   ```
3. Reset database neu can:
   ```bash
   cd apps/api
   pnpm db:push --force-reset
   pnpm db:push
   pnpm db:seed
   ```

### Xem Log Chi Tiet

```bash
# Log structured (JSON)
cd apps/api
pnpm dev  # Xem log tren terminal

# Log trong database
psql -U postgres -d neondb -c "SELECT * FROM \"ApiUsageLog\" ORDER BY \"createdAt\" DESC LIMIT 20;"
```

---

## Checklist Nhanh

- [ ] Da cai dat dependencies (`pnpm install`)
- [ ] PostgreSQL dang chay (local hoac Neon)
- [ ] Da cau hinh `.env` voi `DATABASE_URL` va `NINE_ROUTER_API_KEY`
- [ ] Da dong bo schema (`pnpm db:push`)
- [ ] Da seed database (`pnpm db:seed`)
- [ ] Backend dang chay (`pnpm dev` trong `apps/api`)
- [ ] Frontend dang chay (`pnpm dev` trong `apps/web`)
- [ ] Co the dang nhap voi `admin@aicorp.com` / `admin123`
- [ ] Co the tao du an moi
- [ ] Agent dang hoat dong (xem Virtual Office)

---

## Ho Tro

- Doc [API.md](API.md) cho chi tiet API endpoints
- Doc [DEPLOYMENT.md](DEPLOYMENT.md) cho cau hinh production
- Mo issue tren GitHub neu gap van de
