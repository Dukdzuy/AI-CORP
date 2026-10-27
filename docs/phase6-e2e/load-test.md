# Phase 6 load test (Task 28), 2026-10-26

`scripts/perf/load-test.mjs` against the API built from this branch, on the same stack as the e2e run (`README.md`): one Node process, PostgreSQL 16 and Redis on a 4-core container that also runs the load generator, the mock LLM and, when projects are created, their workflows (QC runs the generated tests locally). Budgets are in `scripts/perf/budgets.json` and are set for **20 concurrent users**; the 50-user runs show where the process saturates.

The request mix is what a dashboard user does: list and open projects, tasks, cost report, agent analytics, a project's forecast and its code quality. `--create-every N` adds project creation, which starts a full workflow run.

## Defects found by the load test, and their fixes

| # | Finding | Fix | Effect |
|---|---------|-----|--------|
| P1 | `GET /projects/:id/code-quality` took 3.1 s at p50 with 50 users: every request parsed every generated file with the TypeScript compiler, and its dozen sequential file reads queued behind the running workflows' I/O | `CodeQualityService` keeps metrics per file content (sha1 of path and content) and each project's assessment for 30 s; the DEV agent invalidates it when it rewrites the code (`invalidate`, also called by `writeReport`). Files are read in parallel | p50 3116 → 196 ms in the same scenario; 6 ms with one user |
| P2 | `GET /projects` loaded each project's latest run, with its whole `context` JSON, and its `ooadMetadata` (2.4 KB of a 2.7 KB row), and then dropped both in `mapToDTO` | `PrismaProjectRepository.findAll` selects only the DTO columns | 46 → 9 ms with one user and ~120 projects |
| P3 | `GET /projects/:id` ran its four independent reads one after another | `ProjectApplicationService.getProjectDetails` runs them with `Promise.all` | 16 → 9 ms with one user |

Throughput at saturation went from 98.8 to 178 req/s in the original scenario (50 users, project creation), and from 151 to about 200 req/s for read traffic.

## Results after the fixes

### 1 user (latency without queueing)

1 virtual users for 20 s against `http://localhost:3000/api`: **1612 requests, 80.6 req/s, error rate 0.00 %** (budget 1 %).
| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 161 | 39 | 51 | 58 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 80 | 5 | 8 | 18 | 100/500/1000 | 0 | within budget |
| `GET /projects` | 409 | 9 | 11 | 13 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 318 | 9 | 13 | 25 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id/code-quality` | 171 | 6 | 13 | 20 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 164 | 12 | 17 | 25 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 153 | 9 | 14 | 17 | 100/500/1000 | 0 | within budget |
| `GET /tasks?projectId` | 156 | 7 | 10 | 14 | 100/500/1000 | 0 | within budget |

### 20 users, read traffic (the budget's target)

20 virtual users for 30 s against `http://localhost:3000/api`: **6078 requests, 201.8 req/s, error rate 0.00 %** (budget 1 %).
| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 578 | 128 | 199 | 229 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 300 | 81 | 154 | 187 | 100/500/1000 | 0 | within budget |
| `GET /projects` | 1505 | 79 | 148 | 182 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 1242 | 86 | 150 | 187 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id/code-quality` | 615 | 58 | 404 | 556 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 623 | 130 | 219 | 257 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 628 | 102 | 177 | 222 | 100/500/1000 | 0 | **over budget** |
| `GET /tasks?projectId` | 587 | 76 | 136 | 178 | 100/500/1000 | 0 | within budget |

Every endpoint is within budget except the cost report, 2 ms over its 100 ms p50 (9 ms with one user, and 85 ms in the run before this one): the time is queueing for the CPU, not the query, which uses the `[projectId, createdAt]` index.

### 20 users while 40 projects are created and their workflows run

20 virtual users for 30 s against `http://localhost:3000/api`: **4643 requests, 153.2 req/s, error rate 0.00 %** (budget 1 %), 40 projects created.
| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 457 | 157 | 275 | 422 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 260 | 103 | 208 | 296 | 100/500/1000 | 0 | **over budget** |
| `GET /projects` | 1116 | 99 | 193 | 287 | 100/500/1000 | 0 | within budget |
| `GET /projects/:id` | 926 | 102 | 200 | 267 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id/code-quality` | 492 | 87 | 539 | 651 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 457 | 157 | 296 | 438 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 462 | 121 | 229 | 370 | 100/500/1000 | 0 | **over budget** |
| `GET /tasks?projectId` | 433 | 91 | 200 | 246 | 100/500/1000 | 0 | within budget |
| `POST /projects` | 40 | 330 | 459 | 622 | 500/2000/3000 | 0 | within budget |

The p95 and p99 budgets hold; the p50 of the cheapest requests rises to 100–120 ms because the workflows (8 agents each, QC running Jest) share the 4 cores with the API and the load generator. Project creation (NFR-PERF-001: under 2 s) stays at 330 ms p50, 622 ms p99.

### 50 users with project creation (the scenario of the first run)

50 virtual users for 30 s against `http://localhost:3000/api`: **5390 requests, 178.3 req/s, error rate 0.00 %** (budget 1 %), 19 projects created.
| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 551 | 277 | 407 | 481 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 265 | 256 | 396 | 471 | 100/500/1000 | 0 | **over budget** |
| `GET /projects` | 1297 | 235 | 351 | 390 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id` | 1134 | 235 | 344 | 392 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id/code-quality` | 494 | 196 | 1422 | 1547 | 300/1500/3000 | 0 | within budget |
| `GET /projects/:id/estimate` | 520 | 359 | 529 | 580 | 300/1500/3000 | 0 | **over budget** |
| `GET /reports/projects/:id/cost` | 571 | 281 | 444 | 490 | 100/500/1000 | 0 | **over budget** |
| `GET /tasks?projectId` | 539 | 226 | 358 | 387 | 100/500/1000 | 0 | **over budget** |
| `POST /projects` | 19 | 643 | 808 | 808 | 500/2000/3000 | 0 | **over budget** |

At 50 users the single process is saturated (178 req/s), so every request waits about 50 / 178 ≈ 280 ms (Little's law) and the 100 ms p50 budgets are missed; there are still no errors and every p99 is under 1.6 s. Serving more users needs more API processes (the API is stateless; runs are coordinated through BullMQ and PostgreSQL), which is outside this phase.

## Before the fixes (first run, 50 users with project creation)

50 virtual users for 30 s against `http://localhost:3000/api`: **3125 requests, 98.8 req/s, error rate 0.00 %** (budget 1 %), 14 projects created.
| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |
|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|
| `GET /analytics/agents` | 311 | 124 | 247 | 302 | 300/1500/3000 | 0 | within budget |
| `GET /health` | 160 | 129 | 269 | 358 | 100/500/1000 | 0 | **over budget** |
| `GET /projects` | 775 | 143 | 266 | 316 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id` | 613 | 220 | 390 | 458 | 100/500/1000 | 0 | **over budget** |
| `GET /projects/:id/code-quality` | 339 | 3116 | 3702 | 3920 | 300/1500/3000 | 0 | **over budget** |
| `GET /projects/:id/estimate` | 315 | 193 | 363 | 431 | 300/1500/3000 | 0 | within budget |
| `GET /reports/projects/:id/cost` | 289 | 149 | 270 | 340 | 100/500/1000 | 0 | **over budget** |
| `GET /tasks?projectId` | 309 | 112 | 239 | 312 | 100/500/1000 | 0 | **over budget** |
| `POST /projects` | 14 | 369 | 642 | 642 | 500/2000/3000 | 0 | within budget |

## Reproduce

```bash
node scripts/perf/load-test.mjs --api http://localhost:3000/api --users 20 --duration 30 --create-every 0 --out report.md
node scripts/perf/load-test.mjs --users 20 --duration 30 --create-every 10   # with workflows running
node scripts/perf/load-test.mjs --users 50 --duration 30 --create-every 25   # saturation
```
