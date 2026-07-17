# v2 Plan — Asahi Shimbun Part-Time Attendance & Expense System

> **Client:** 朝日新聞総合サービス株式会社 (via モラブ阪神工業株式会社 / MORABU)
> **Product:** アルバイト勤怠・交通費請求書自動作成システム
> **Status:** planning — this document is the agreed execution plan. No app code written yet.
> **Deliverable type:** **demo site** (UI required). It is a foot-in-the-door for the real contract.
> **Everything must run on free tiers — zero paid services.**
> Updated: 2026-07-17 (reconciled against the client requirements PDF + all 8 sample documents).

---

## 0. What this is, and why it matters

Asahi Shimbun hires part-time staff (アルバイト) for its **high-school-baseball (高校野球)** coverage at
stadiums. Today, their attendance, transport claims, and wage invoicing are **all manual**. **MORABU
(モラブ阪神工業) is the software vendor** engaged to build the system that automates it; we build it for MORABU.

**This is a demo to win the real project.** The path (from the requirements doc §5):
1. Present a demo **by next Friday** (UI included).
2. MORABU sends feedback → we revise.
3. **End of month:** MORABU sends the demo site to Asahi Shimbun.
4. Asahi presents it to their **Tokyo head office**.
5. **~April next year:** Asahi decides whether to adopt it for the high-school-baseball operation.
6. A formal development contract depends on that decision.

So the demo has two audiences: MORABU (our client) and, downstream, Asahi's Tokyo HQ. It must look
**production-credible** and must **reproduce Asahi's real documents exactly**.

---

## 1. The single most important insight — two scopes, don't confuse them

The two document sets we were given describe the system at **different altitudes**, and the winning
strategy is to honour both:

| Source | Location | What it defines |
|---|---|---|
| **Requirements PDF** (佐野, MORABU) | `docs/…要件書.pdf` | The **demo scope + UI**: what staff/admin screens to build, and how simple staff entry must be. |
| **8 sample documents** (Asahi's real forms) | `assets/asahidoc1–8.jpeg` | The **output fidelity target**: the exact 勤務表 / 請求明細書 / 給料計算書 the system must generate, to the yen. |

**The requirements doc deliberately keeps the staff UI simple** — staff only enter *date, start/end
time, stadium, break*. Wage/overtime/tax math is **not** typed by staff; it is computed by the engine
and appears only in the **generated documents**. The "wow" moment for Asahi's Tokyo presentation is:
*"the staff just tap in their hours, and out comes our exact 請求明細書 and 給料計算書, correct to the
yen."* That is what wins the contract.

> **Design rule:** simple inputs, faithful outputs. Complexity lives in the **engine** and the
> **document templates**, never in the staff entry screen.

---

## 2. Source documents — verified inventory

All 8 sample images were read and cross-checked. Figures below are confirmed against the primary
scans (not assumed).

| # | Document | Role in the system |
|---|---|---|
| 1 | **勤務表** (timesheet) | Daily start/end/break → actual hours. Two cost buckets: **大会経費（直接費）** / **編集費（間接費）**. Sample: 101h across **14 days**. Header note: *弁当代 paid only during 大会 period AND when a day's hours > 6h.* |
| 2 | **アルバイト料請求明細書（高校野球用）** | The wage invoice. Rate lines + cost totals. Sample **請求額合計 ¥185,340**. Shows `課税分計 131,300` and `(課税額計算用)日当 9,378` (= 131,300 ÷ 14, reference only). |
| 3 | **交通費** | Per-trip one-way routes (円山⇄大阪, バス・電車, **¥1,930** each). Two trips/day (round trip). Total **¥54,040**. All in 編集費 bucket. |
| 4 | **出張日当 / 私有携帯電話使用料 / その他（宿泊実費）** | Three optional expense sheets. **Blank in the sample** — supported categories, zero this month. |
| 5 | **給料計算書** (payslip) | 給料 131,300 + 交通費 54,040 = 支給額計 **185,340** − 所得税 **188** = 差引支給額 **185,152**. Issued by 朝日新聞社, dated 2026/7/15. |
| 6 | **Calculation sheet** | The per-day engine: daily wage → **税額ランク** (= a row index in the 丙 table) → daily 税額 → **税額合計 188**. This is the ground truth for the tax algorithm. |
| 7–8 | **給与所得の源泉徴収税額表（日額表・丙）令和8年** | The 2026 daily withholding-tax lookup table, category 丙. Rows are ¥100-wide brackets. Fully transcribed (see §3.3). |

---

## 3. Verified domain rules (the golden master)

Every rule below was reproduced by hand from the sample month and **must** be reproduced by the
calculation engine's automated test. These are non-negotiable acceptance criteria.

### 3.1 Rules

| Rule | Detail | Verified |
|---|---|---|
| **Worked minutes** | `(end − start) − breakMinutes`. Break is self-reported; if "break taken", staff enter minutes. | ✅ sums to 101:00 |
| **Per-day wage** | `Math.round(workedMinutes × ¥1,300 / 60)`. Rounded **per day**, then summed. | ✅ sums to **¥131,300** |
| **Per-day tax** | Each day's wage → 日額表・丙 bracket → that row's 税額 → **summed over days** (NOT computed on the monthly total). | ✅ sums to **¥188** |
| **Rounding** | `Math.round` (half-up). 5:40 → 340min × 1300/60 = 7,366.67 → **7,367**. | ✅ |
| **Two cost buckets** | Every wage/expense line tagged 大会経費（直接費） or 編集費（間接費）. Sample: all 間接費. | ✅ |
| **Rates** (from invoice) | 時給 **¥1,300** / 時間外≤60h **¥325** / 時間外>60h **¥650** / 深夜割増 **¥325**. | ✅ |
| **Overtime** | 60h/month threshold model (¥325 ≤60h, ¥650 >60h). **Zero in sample.** | ✅ (0) |
| **Lunch (弁当代)** | Flat amount, paid **only** during 大会 period **AND** day's worked hours **> 6h**. **Zero in sample.** | ✅ (0) |
| **Transport** | Registered **one-way** fare × 2 (round trip) per work day. Capped at registered fare (see §5.2). Non-taxable. | ✅ ¥1,930×2×14 = **¥54,040** |
| **Net pay** | `支給額計 − 所得税` = 185,340 − 188 = **¥185,152**. | ✅ matches payslip |

### 3.2 Sample month, day by day (June 2026 — all 編集費/間接費)

| Date | Hours | Daily wage | 税額ランク (丙 row) | Daily tax |
|---|---|---|---|---|
| 6/1 (月) | 8:00 | 10,400 | 71 | 22 |
| 6/3 (水) | 7:50 | 10,183 | 68 | 12 |
| 6/5 (金) | 8:00 | 10,400 | 71 | 22 |
| 6/9 (火) | 5:00 | 6,500 | 32 | 0 |
| 6/10 (水) | 8:00 | 10,400 | 71 | 22 |
| 6/12 (金) | 4:00 | 5,200 | 19 | 0 |
| 6/16 (火) | 8:00 | 10,400 | 71 | 22 |
| 6/17 (水) | 8:00 | 10,400 | 71 | 22 |
| 6/19 (金) | 7:00 | 9,100 | 58 | 0 |
| 6/22 (月) | 8:00 | 10,400 | 71 | 22 |
| 6/23 (火) | 8:00 | 10,400 | 71 | 22 |
| 6/24 (水) | 8:00 | 10,400 | 71 | 22 |
| 6/26 (金) | 7:30 | 9,750 | 64 | 0 |
| 6/29 (月) | 5:40 | 7,367 | 40 | 0 |
| **Total** | **101:00** | **131,300** | — | **188** |

Tax check: 8 days × ¥22 + 1 day × ¥12 = **¥188** ✅

### 3.3 The 丙 tax table (令和8年 日額表), as transcribed

`税額ランク` on the calc sheet is literally the **row index** of the bracket in this table. Encode it
as ordered `[minInclusive, maxExclusive, tax]` rows:

- Rows **1–64**: bracket top ≤ ¥9,800 → tax **0** (e.g. `[9,700, 9,800) → 0`).
- Row **65** `[9,800, 9,900) → 1`
- Row **66** `[9,900, 10,000) → 5`
- Row **67** `[10,000, 10,100) → 8`
- Row **68** `[10,100, 10,200) → 12`
- Row **69** `[10,200, 10,300) → 15`
- Row **70** `[10,300, 10,400) → 19`
- Row **71** `[10,400, 10,500) → 22`
- … increasing ~¥3–4/bracket …
- Row **114** `[14,700, 14,800) → 181` ← **last transcribed row.**

Lookup: find the row where `min ≤ dailyWage < max`; its `tax` is the day's withholding.

> **Coverage gap (must handle):** the transcribed table ends at ¥14,800/day. At ¥1,300/h that is
> ~11h22m in a single day — beyond it, we must extend with the official 令和8年 丙 rows (deterministic
> formula above ~¥14,800). For the demo, days never exceed this, but the engine must **not silently
> return 0** above ¥14,800 — it should throw or use the extended rows. See open question Q1.

---

## 4. Functional requirements (from the requirements PDF §2–4)

### 4.1 Roles & login
Single login screen; route by role. **アルバイト (staff)** and **管理者 (admin)**.

### 4.2 Staff features
- **Attendance entry (per day):** work date, start time, end time, **stadium**, break taken? → if yes,
  break minutes. Worked time auto-computed. *(No wage/tax/overtime fields — kept simple.)*
- **Transport auto-calc:** staff picks "today's stadium" → system auto-applies the **registered fare**
  from their home nearest station to that stadium's nearest station. Capped at the registered fare;
  a cheaper alternate route is allowed, exceeding it is not (§5.2).
- **My Page:** this month's work-day count + total hours; daily attendance list; daily transport list
  + monthly transport total.
- **Monthly export:** end-of-month summary → **PDF** (in Asahi's format) → **download** and **email to
  self**.

### 4.3 Admin features (master data + oversight)
- **球場マスタ** (stadium): name, address, nearest station.
- **アルバイトマスタ** (staff): name, address, nearest station, phone, email.
- **アカウント** (account): name, email, password, role.
- **区間別交通費マスタ** (route fare): home nearest station ⇔ stadium nearest station → fare + route + mode.
  For the demo, admin looks these up manually (乗換案内 etc.) and enters them.
- **Overall review:** all staff's attendance + expense records.

### 4.4 Screen list (planned)
`Login`
Staff: ① My-page home (month summary) · ② Attendance & expense entry (per day) · ③ Monthly summary + PDF DL + email
Admin: ① Stadium master · ② Staff master · ③ Route-fare master · ④ Overall records review
*(Account master folds into Staff/Admin management.)*

---

## 5. Architecture decision

**Build a fresh, standalone repo for Asahi.** The existing attendance-system monorepo is a
**read-only reference** for proven patterns (auth, migrations, i18n, deploy config) — we **do not edit
it and do not write any code there**. All new code lives in this project (`asahishinbun/`), its own
git repo, so the demo is clean, self-contained, and independently deployable.

### 5.1 Stack — all free tier

| Layer | Choice | Free-tier note |
|---|---|---|
| **Monorepo** | npm workspaces (`client` / `server` / `shared`) — **new**, in `asahishinbun/` | — |
| **Frontend** | React + Vite + i18n (JP/EN) | Static, deployable to Vercel/Netlify free |
| **Backend** | Node + Express + JWT auth/roles | Render free web service (spins down when idle; fine for a demo) |
| **Database** | **Postgres on Neon** (serverless, always-on free tier) | Preferred over Render Postgres (which expires); Supabase free is the fallback |
| **Calc engine** | Pure TS module in `shared/` | Zero deps, zero cost |
| **Documents** | HTML/CSS templates → **PDF** via headless Chromium (`puppeteer-core` + `@sparticuz/chromium`), Noto Sans JP embedded | Runs within Render's 512MB for single-page render; **client `window.print()`** is the zero-cost interactive-download fallback |
| **Email** | `nodemailer` + **Brevo** SMTP (300/day free) or Gmail app-password SMTP | Truly free for demo volumes |
| **Deploy** | Render (API) + Vercel (client) + Neon (DB), all free | See §11 cost table — total **$0** |

- **Reference only (read, re-implement — never import or edit):** auth/JWT/roles, monorepo layout,
  migrations tooling, i18n setup, test harness, deploy config from the existing attendance system.
- **Build fresh here:** everything — data model, calculation engine, both dashboards, document templates.
- The existing attendance app is untouched and unrelated to this repo.

> **PDF note:** the requirements doc explicitly says **PDF** (§3.4) and **email the PDF** — so PDF, not
> Excel, is the primary output here (unlike the older todoke Excel path). HTML/CSS templating gives the
> most faithful reproduction of the intricate Japanese form layouts and is font-controllable.

### 5.2 Transport rule (precise)
- Route fare is stored **one-way**, keyed by `(home station, stadium station)`.
- Per work day the engine emits **two trip lines** (outbound + return) = one-way × 2.
- Reimbursement is **capped** at the registered fare. Alternate route allowed only if **actual ≤
  registered**; any claim **> registered is rejected**. For the demo, staff normally accept the auto fare.

---

## 6. The hard part — calculation correctness (de-risk first)

Core risk: **wrong yen → Asahi rejects the deliverable.** Mitigation:

1. **Isolate all money math** into a pure, dependency-free module in `shared/` — no DB, no HTTP.
2. **Encode the 丙 tax table as data**, not logic (§3.3), versioned by year (令和8年).
3. **Golden-master test:** encode the sample month as a fixture; assert the engine reproduces the real
   documents **to the yen** — `¥131,300` (wages), `¥188` (tax), `¥54,040` (transport), `¥185,152` (net).
4. **Every other layer (API, UI, PDF) only calls this proven engine** — no money math anywhere else.

One tested source of truth for every calculation. This test is also the **strongest demo artifact** —
green output that says "reproduces Asahi's June documents exactly."

---

## 7. Data model (new migrations on top of reused `users`)

```
users            reuse — add role (staff | admin), password, name, email
staff_profiles   1:1 with users(role=staff): address, home_nearest_station, phone
stadiums         name, address, nearest_station
route_fares      from_station, to_station(stadium), one_way_fare, mode, route_note   (unique per pair)
attendance       staff_id, work_date, stadium_id, start, end, break_taken, break_minutes,
                 worked_minutes(computed), bucket(default 間接費), overtime_min, night_min
expense_lines    staff_id, date, category(transport|perdiem|phone|lodging|other),
                 bucket, amount, description   (transport rows auto-generated from route_fares)
rate_config      hourly / ot≤60 / ot>60 / night / lunch — admin-editable, no redeploy
tax_table        丙 rows {year, min, max, tax} — versioned (令和8年)
```

---

## 8. Document generation (the fidelity layer)

Reproduce three Asahi documents as HTML/CSS templates filled from engine output, exported to PDF:
1. **勤務表** (timesheet) — two-bucket daily grid, from `attendance`.
2. **アルバイト料請求明細書** — rate lines + bucket totals + 請求額合計, from engine.
3. **給料計算書** (payslip) — 給料 / 交通費 / 支給額計 / 所得税 / 差引支給額, from engine.

Templates must match the scans' layout closely enough that Asahi recognises their own forms. Same
data → PDF (download + email attachment) and on-screen HTML (interactive `window.print()` fallback).

---

## 9. Execution order (smallest-provable-first)

| Phase | Deliverable | Why this order |
|---|---|---|
| **1. Calc engine + golden test** (`shared/`) | The math, proven against the June documents to the yen | Zero deps; de-risks the whole project; provable before any UI exists |
| **2. Data model + migrations** | Schema for users/staff/stadiums/route_fares/attendance/expenses/rates/tax | Foundation for API |
| **3. Backend API** | Auth + staff CRUD (attendance/transport) + admin masters + review + compute endpoint | Wires engine to data |
| **4. Document + PDF generation** | 3 HTML→PDF templates, download + email | Reuses engine output; the demo centrepiece |
| **5. Two dashboards** | Staff entry/my-page/export UI + admin master/review UI | Sits on proven layers |
| **6. Seed + polish** | Seed the June sample (so the demo opens on a filled, correct month) + JP/EN + styling | Makes the demo land |

**Immediate next step:** Phase 1 — the tested engine that reproduces Asahi's documents to the yen.

---

## 10. Provisional decisions (requirements doc §5 asks us to decide; confirm with MORABU)

The client explicitly delegates judgment calls to us for the demo. Proposed defaults:

| # | Decision | Provisional default | Confidence |
|---|---|---|---|
| P1 | Cost bucket for staff entries | Default **編集費（間接費）**; admin can retag to 大会経費 | High (matches sample) |
| P2 | Transport = round trip | One-way registered fare **× 2** per work day | High (28 trips / 14 days) |
| P3 | Overtime input | **Not** staff-entered; engine computes (0 in sample); admin can adjust | Med |
| P4 | 弁当代 flat amount | The calc sheet legend suggests a flat figure (≈¥500?) — **placeholder, confirm** | **Low — needs MORABU** |
| P5 | Emails in demo | Send to the staff member's own address only (no client data leaves) | High |
| P6 | Seeded demo data | Pre-load the June sample month so the demo opens correct-to-the-yen | High |

---

## 11. Free-tier cost proof

| Service | Plan | Monthly cost | Limit vs demo need |
|---|---|---|---|
| Neon Postgres | Free | **$0** | 0.5GB storage — far beyond demo |
| Render (API) | Free web service | **$0** | Spins down when idle; wakes on request (~30s) — acceptable for a demo |
| Vercel (client) | Hobby | **$0** | Static hosting, ample |
| Brevo / Gmail SMTP (email) | Free | **$0** | 300 emails/day — demo sends a handful |
| PDF (self-hosted Chromium) | — | **$0** | No third-party API |
| **Total** | | **$0** | |

*Only caveat to flag to MORABU:* Render free spins down on idle (first hit after inactivity is slow).
If the Tokyo presentation needs instant load, warm it just before, or note it's a free-tier artifact.

---

## 12. Open questions (reduced — most are now resolved from the scans)

1. **Q1 — daily wage > ¥14,800:** the transcribed 丙 table stops at ¥14,800/day. Confirm we should
   extend it with the official 令和8年 rows (the demo never exceeds it, but the engine must not return
   a silent 0). *Engineer's call: extend the table; low risk.*
2. **Q2 — 弁当代 amount** (P4): the one number not fully legible in the documents. Ask MORABU.
3. **Q3 — Asahi-provided PDF template:** requirements §3.4 says the PDF format follows a template Asahi
   will provide. Until it arrives, we reproduce from the sample scans (docs 1/2/5). Confirm we can
   proceed on the scans.
4. **Q4 — Approval flow:** does admin just view+generate, or approve/reject staff submissions first?
   Requirements imply view+generate only. *Default: no approval step for the demo.*
5. **Q5 — Multi-stadium / multiple staff:** demo with the one sample worker + a couple of seeded
   stadiums/routes, or a broader roster? *Default: sample worker + 2–3 stadiums to show the master flow.*

---

## 13. Timeline (mapped to requirements doc §5)

| When | Milestone |
|---|---|
| **This week → next Friday** | Phases 1–5 → working demo with UI, reproducing the June documents |
| After feedback | Revise per MORABU |
| End of month | MORABU sends demo site to Asahi Shimbun |
| ~April next year | Asahi decides on adoption → potential formal contract |

**One tested source of truth for every calculation; simple inputs, faithful outputs.**
