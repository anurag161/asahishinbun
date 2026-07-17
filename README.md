# Asahi Shimbun — Part-Time Attendance & Transportation Expense System

Demo web system that automates attendance reporting, transportation-expense claims, and
part-time wage invoicing for 朝日新聞総合サービス's high-school-baseball (高校野球) stadium staff.

Built for **MORABU (モラブ阪神工業)** as a demo to win the production contract. Runs entirely on
free tiers — see [`v2plan.md`](./v2plan.md) for the full execution plan, verified domain rules, and
free-tier architecture.

## Monorepo layout

```
shared/   Pure, dependency-free domain: the payroll/tax calculation engine + types   ← Phase 1 ✅
server/   Node + Express API (auth, masters, attendance, expenses, payroll)          ← Phase 2–3 ✅
client/   React + Vite dashboards (staff + admin), JP/EN                              (Phase 5)
docs/     Client requirements PDF (要件書)
assets/   Client's sample source documents (勤務表 / 請求明細書 / 給料計算書 / 丙税額表)
```

## API surface (Phase 3)

Single login; role decides access (`staff` / `admin`). JWT Bearer tokens.

| Method + path | Role | Purpose |
|---|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` | any | Login / current user |
| `GET/POST/PUT/DELETE /api/attendance` | staff | Own attendance; POST auto-applies round-trip transport |
| `GET/POST/DELETE /api/expenses` | staff | Manual expenses (fare-capped for transport) |
| `GET /api/mypage/summary?month=` | staff | Month summary + payroll |
| `GET /api/stadiums` | any | Stadium list (staff pick a stadium) |
| `POST/PUT/DELETE /api/stadiums` | admin | 球場マスタ |
| `GET/POST/DELETE /api/admin/route-fares` | admin | 区間別交通費マスタ |
| `GET/POST /api/admin/staff` · `PUT /api/admin/staff/:id/profile` | admin | アルバイトマスタ + accounts |
| `GET/PUT /api/admin/rates` | admin | Pay rates (no redeploy) |
| `GET /api/admin/records?month=` | admin | 全体実績確認 (per-staff summaries) |
| `GET /api/payroll/:staffId?month=` | staff(self)/admin | Full engine result |

Demo credentials after seeding: `admin@example.com / admin123`, `staff@example.com / staff123`.

## Status

**Phases 1–3 complete.** The engine is the single tested source of truth for every yen; the API
computes money in exactly one place (`computePayroll`). The golden-master reproduces the client's
real June 2026 documents exactly — end-to-end through the DB and the HTTP API:

| Figure | Document | Value |
|---|---|---|
| 給料 (wage) | 請求明細書 | ¥131,300 |
| 所得税 (tax) | 給料計算書 | ¥188 |
| 交通費 (transport) | 交通費明細 | ¥54,040 |
| 支給額計 (gross) | 給料計算書 | ¥185,340 |
| 差引支給額 (net) | 給料計算書 | ¥185,152 |

## Develop

```bash
npm install        # install workspace deps
npm test           # run the golden-master + unit tests (vitest)
npm run build      # type-check and compile shared/
npm run test:watch # watch mode
```

## Key design rule

**Simple inputs, faithful outputs.** Staff enter only date / start-end / stadium / break. All money
math lives in `shared/` (`computePayroll`) — no calculation anywhere else in the stack.
