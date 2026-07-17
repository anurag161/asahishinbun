# Asahi Shimbun — Part-Time Attendance & Transportation Expense System

Demo web system that automates attendance reporting, transportation-expense claims, and
part-time wage invoicing for 朝日新聞総合サービス's high-school-baseball (高校野球) stadium staff.

Built for **MORABU (モラブ阪神工業)** as a demo to win the production contract. Runs entirely on
free tiers — see [`v2plan.md`](./v2plan.md) for the full execution plan, verified domain rules, and
free-tier architecture.

## Monorepo layout

```
shared/   Pure, dependency-free domain: the payroll/tax calculation engine + types   ← Phase 1 ✅
server/   Node + Express API (auth, masters, attendance, documents)                  (Phase 2–4)
client/   React + Vite dashboards (staff + admin), JP/EN                              (Phase 5)
docs/     Client requirements PDF (要件書)
assets/   Client's sample source documents (勤務表 / 請求明細書 / 給料計算書 / 丙税額表)
```

## Status

**Phase 1 complete — the calculation engine.** It is the single tested source of truth for every
yen. Its golden-master test reproduces the client's real June 2026 documents exactly:

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
