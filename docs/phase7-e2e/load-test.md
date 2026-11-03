# Load test on the production build (2026-11-03)

`scripts/perf/load-test.mjs` against the API of master after PR #15, started as in `README.md` (production mode, one Node process, PostgreSQL 16 and Redis on a 4-core container that also runs the load generator and the scripted LLM). The database starts from the demo data (5 projects) and grows as the scenarios create projects. Budgets: `scripts/perf/budgets.json`.

The Phase 6 run (`docs/phase6-e2e/load-test.md`) used a database of about 120 projects, so its throughput is not directly comparable with these numbers; compare the budget results instead. At 20 users both runs stay within (or, for one endpoint then, 2 ms over) the budgets, with no errors.

The 50-user scenario saturates the single process (≈ 407 req/s, Little's law ≈ 123 ms wait) and misses five 100 ms p50 budgets; the script exits 1 for it, as designed.

## Run 2026-11-03T02:30:10.326Z

1 virtual users for 20 s against `http://localhost:3000/api`: **3695 requests, 184.7 req/s, error rate 0.00 %** (budget 1 %).

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 378 | 6 | 8 | 11 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 173 | 4 | 6 | 8 | 100/500/1000 | 0 | within budget |
| `GET /projects` | 919 | 4 | 6 | 8 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 754 | 6 | 8 | 10 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id/code-quality` | 364 | 3 | 4 | 7 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 401 | 7 | 10 | 12 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 312 | 6 | 8 | 10 | 100/500/1000 | 0 | within budget |
| `GET /tasks?projectId` | 394 | 4 | 5 | 9 | 100/500/1000 | 0 | within budget |

## Run 2026-11-03T02:30:40.805Z

20 virtual users for 30 s against `http://localhost:3000/api`: **18154 requests, 604.8 req/s, error rate 0.00 %** (budget 1 %).

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 1832 | 30 | 44 | 52 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 911 | 54 | 84 | 97 | 100/500/1000 | 0 | within budget |
| `GET /projects` | 4472 | 28 | 42 | 51 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 3674 | 31 | 46 | 54 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id/code-quality` | 1794 | 20 | 33 | 44 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 1838 | 47 | 66 | 78 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 1751 | 36 | 51 | 59 | 100/500/1000 | 0 | within budget |
| `GET /tasks?projectId` | 1882 | 27 | 41 | 51 | 100/500/1000 | 0 | within budget |

## Run 2026-11-03T02:31:11.271Z

20 virtual users for 30 s against `http://localhost:3000/api`: **12941 requests, 430.7 req/s, error rate 0.00 %** (budget 1 %), 111 projects created.

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 1313 | 41 | 69 | 90 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 661 | 72 | 118 | 184 | 100/500/1000 | 0 | within budget |
| `GET /projects` | 3215 | 41 | 68 | 94 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 2600 | 40 | 63 | 93 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id/code-quality` | 1246 | 26 | 50 | 102 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 1269 | 60 | 95 | 140 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 1281 | 46 | 84 | 132 | 100/500/1000 | 0 | within budget |
| `GET /tasks?projectId` | 1245 | 36 | 62 | 87 | 100/500/1000 | 0 | within budget |
| `POST /projects` | 111 | 107 | 158 | 177 | 500/2000/3000 | 0 | within budget |

## Run 2026-11-03T02:31:41.784Z

50 virtual users for 30 s against `http://localhost:3000/api`: **12252 requests, 407.2 req/s, error rate 0.00 %** (budget 1 %), 48 projects created.

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 1183 | 110 | 153 | 221 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 527 | 207 | 277 | 329 | 100/500/1000 | 0 | **over budget** |
| `GET /projects` | 3070 | 109 | 151 | 201 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id` | 2485 | 106 | 148 | 202 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id/code-quality` | 1271 | 77 | 142 | 624 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 1252 | 164 | 236 | 334 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 1188 | 129 | 187 | 244 | 100/500/1000 | 0 | **over budget** |
| `GET /tasks?projectId` | 1228 | 102 | 143 | 192 | 100/500/1000 | 0 | **over budget** |
| `POST /projects` | 48 | 312 | 388 | 491 | 500/2000/3000 | 0 | within budget |

