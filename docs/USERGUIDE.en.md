# User Guide — Attendance & Transport System

Asahi Shimbun General Services — part-time attendance & transport-expense system
（日本語版: [USERGUIDE.ja.md](./USERGUIDE.ja.md)）

A getting-started guide for first-time users. Screens shown use the June 2026 sample data.

---

## 1. What the system does

For part-time staff working the high-school baseball tournament, it handles:

- Recording daily **attendance** (work day, hours, stadium) and **transport / expenses**
- Auto-generating the **timesheet, invoice, payslip and attachments** from those records (PDF, email)
- Auto-calculating withholding tax (daily table, category 丙), transport, meal allowance, etc.

There are two kinds of user:

| Role | Can do |
|---|---|
| **Staff** (part-timer) | Enter their own attendance/expenses; view, PDF and email their own monthly documents |
| **Admin** | Review all staff, manage the masters (stadiums, staff, route fares, pay rates, accounts), configure email |

---

## 2. Signing in

1. Open the system URL.
2. Enter your **email** and **password**, then press **Sign in**.
3. The **eye icon** at the right of the password field shows/hides what you typed.
4. The **EN / 日本語** button (top right) switches the display language.

Demo accounts (also shown on the sign-in screen):

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | admin123 |
| Staff | staff@example.com | staff123 |

After signing in you land on the screen for your role (staff → My Page, admin → All Records).

---

## 3. Staff

Top menu: **My Page / Attendance & Expenses / Monthly · Documents**

### 3-1. My Page

Shows this month's totals (work days, total hours, transport, net pay, salary, gross, tax) and a per-day breakdown. Use the **month picker** (top right) to change month; it opens on a month that has data.

### 3-2. Attendance & Expenses

**Add a work day** (form at the top):

1. Enter **Date**, **Stadium**, **Start** and **End**.
2. **Break**: tick **Break taken**, then enter **hours** and **minutes** in the two boxes beside it.

   | Break | Enter |
   | --- | --- |
   | 1 hour | `1` h `0` m |
   | 30 minutes | `0` h `30` m |
   | **1 h 25 m** | **`1` h `25` m** |

   - **Copy `1:25` straight off the paper timesheet into the two boxes.** Any number of minutes can be recorded.
   - The minutes box takes 0–59; anything an hour or longer goes in the hours box.
   - **Decimals cannot be entered.** With hours and minutes separated, there is no way to type `1.25` and have it mistaken for 1 h 25 m.
   - Untick the box to record no break (0 minutes).
   - What you enter (hours + minutes) and what the screens and timesheet PDF show (`1:25`) mean the same thing — no conversion.
3. **Meal allowance**: choose `○ (yes)` or `× (no)`.
   - Selectable **only when the day's worked time exceeds 6 hours**. On days of 6 hours or less it is disabled and shows "Not eligible (worked ≤ 6h)".
4. Press **Add work day**.
   - If a **route fare is registered** between the home station and the stadium station, the **round-trip transport is applied automatically**. If not, only the day is saved; transport appears once an admin registers the route.

**Registered days** (table):

- Columns: date, stadium, start, end, worked, **overtime**, **Meal allowance (○/×)**.
- **Overtime** shows the time worked past 8 hours, calculated for you ("—" when there is none).
- Per row: **pencil icon** = edit that day, **trash icon** = delete.

**Transport & expense lines**: shows the auto transport plus any manual expenses (personal phone, per-diem, lodging, other).

### 3-3. Monthly · Documents

Five documents can be produced:

| Document | Content |
|---|---|
| Timesheet (勤務表) | Per-day work (start, end, break, worked, meal ○/×) |
| Transport (attachment) | One row per one-way leg with fares |
| Per-diem / phone / other (attachment) | Allowance and expense lines |
| Invoice (請求明細書) | Breakdown of salary, transport and other |
| Payslip (給料計算書) | Gross, withholding tax, net pay |

**Time format (the same as the existing paper form)**

On the timesheet and on screen, **break, worked, overtime and night** — and every total — are shown as **h:mm**, not as decimals.

| Field | Example |
|---|---|
| Break | `1:00` / `1:25` |
| Worked (excl. break) | `7:50` / `7:35` |
| Direct / indirect subtotals, grand total | `101:00` / `108:35` |
| **時給換算用勤務時間 (this field only, decimal)** | `101` / `108.58` |

- Not limited to quarter hours — a break of `1:25` prints as `1:25`.
- Totals accumulate past 24 hours (`101:00`), they do not wrap to `5:00`.
- The only decimal figure is **時給換算用勤務時間**, the number the hourly rate is multiplied by (June 2026: `101` × ¥1,300 = ¥131,300).

> **To confirm — how this field is written when it isn't a whole number**
> In the June 2026 timesheet we were given, the total is exactly `101:00`, so the field reads `101` — which cannot tell us whether the form writes decimals or simply whole hours.
> This system prints two decimal places (a `108:35` total becomes `108.58`). If that differs from your practice, tell us and we will match it.

On each document card:

- **View** — render it below the cards
- **PDF** — open the PDF in a new tab (save from there)
- **Email** — send it, with the PDF attached, to your registered address (or the admin's test address, if set)
- The document on screen can also be saved via **Print / Save as PDF**.

**About PDF (it works on the demo)**

- The demo deployment (Render) generates PDFs **server-side**. A Japanese font (Noto Sans JP) is bundled, so kanji and kana render properly rather than as boxes. Each document takes **under about 5 seconds**.
- When the footer reads **"PDF: server-side ready"**, the PDF button is live.
- On any deployment where the server cannot generate PDFs, pressing the button shows **"use the browser's Save as PDF"** instead. Use **View** → **Print / Save as PDF**; the content is identical.

---

## 4. Admin

Top menu: **All Records / Stadiums / Staff / Accounts / Route Fares / Email Settings**

> **About Pay Rates**: it is no longer shown in the top menu. The screen itself is still there —
> open `/admin/rates` directly and it works as before (hourly, overtime, night premium, meal allowance).

### 4-1. All Records

Monthly totals for every staff member (work days, worked, **overtime**, salary, transport, tax, net pay, **meal allowance**).

- The **overtime** column shows the month's hours past 8h/day with the **premium (¥)** they earned underneath.

- The **meal-allowance** column is qualifying days (○) × the **Pay Rates meal amount**. While the amount is unset (¥0) it shows ¥0.
- **Details** on a row opens that person's **per-day breakdown**. There you can re-tag each day as **Tournament (direct) / Editorial (indirect)** — its transport moves to the same bucket. The **Meal allowance (○/×)** is shown too.

### 4-2. Masters

| Screen | Content |
|---|---|
| Stadiums | Name, address, nearest station |
| Staff | Name, postal code, address, home nearest station, phone |
| Route Fares | **One-way fare** between a home station and a stadium station (drives auto transport) |
| Pay Rates (hidden from the menu — `/admin/rates`) | Hourly, overtime (≤60h / >60h), night premium, **meal allowance (flat)** |
| Accounts | Create accounts, change roles, reset passwords, delete |

**The meal-allowance amount** is entered on **Pay Rates** (open `/admin/rates` directly). It starts at **¥0**. Enter an amount and save, and it is added to the wage on qualifying (○) days and flows into the documents and All Records.

### 4-3. Email Settings

For confirming that document email is delivered.

- Set a **test recipient address** and every document email goes there instead of each staff member's own address (no registered address is changed).
- **Send test** sends a throwaway message.
- Clear the field and save to restore normal delivery to each staff member.

**Trying email on the demo**

Mail really is delivered from the demo (over HTTPS; this has been verified end to end). But the sample staff account's registered address is `staff@example.com`, which is **not a real address**, so nothing arrives unless you redirect it first:

1. Open **Email Settings**, enter **your own address** and save.
2. Go **straight** to **Monthly · Documents** and press **Email** on any document.
3. Check your inbox — and your **spam folder**.

- The mail carries the document as the **HTML body**, with the same document **attached as a PDF**.
- On success the screen shows which address it went to.

> **Note — the demo resets Email Settings**
> The demo keeps no data on disk, so after a period of inactivity it sleeps and **wakes with Email Settings cleared**.
> With the field empty, **Email** sends to `staff@example.com` — it reports success and nothing arrives.
> Check the address is still there immediately before testing. A production deployment with a real database does not reset.

---

## 5. How the figures are calculated (reference)

- **Salary**: sum of "worked hours × hourly rate" for each day (plus the overtime premium and any taxable expenses).
- **Overtime**: applied automatically to **anything worked past 8 hours in a day** — nobody enters it.
  - Example: 9 hours worked → `¥1,300 × 8h + ¥1,300 × 1.25 × 1h = ¥12,025`
  - The invoice itemises it as "hourly (all worked time)" plus "overtime (premium)".
  - Past **60 overtime hours in a month**, the remainder moves to the higher premium (1.5× by default).
  - Breaks don't count as worked time: 10:00–19:00 with a 1h break is 8 hours worked, so no overtime.
- **Withholding tax**: looked up **per day** in the daily table (category 丙) and summed — not applied to the monthly total. It starts once a day's taxable amount exceeds about ¥9,800. The overtime premium is taxable and included.
- **About the "estimate" label**: the 丙 daily table held in this system covers up to **¥14,800 per day**. Above that, the tax for that day is an **estimate outside the transcribed range**.
  - When a month contains such a day, **My Page**, **All Records** and the **payslip** show an "**estimate**" label naming the dates. No label means every figure came from the official rows.
  - With overtime paid, this starts at about **10h45m worked** (¥14,869 taxable). Without overtime it took about 11h24m.
  - **In a month showing the label, the withholding tax and net pay are not final.** Confirm the official figure before finalising.
- **Transport**: the registered **one-way fare × 2 (round trip) × work days**, applied **automatically** when a work day is saved. Non-taxable.
  - The amount comes straight from Route Fares. Each leg is recorded as its own line.
  - If a fare is registered for the return direction it is used; otherwise the outbound fare is mirrored.
  - With no route registered, the day is saved and transport is ¥0. Registering the route fills it in.

> **Current scope — actual-cost reimbursement**
> **"Actual cost, capped at the registered fare" cannot be entered from any screen.**
> The cap itself is implemented and enforced internally — a claim above the registered fare is rejected — but there is **no screen for entering an actual cost**, so it is not usable in practice. Transport today is the automatic calculation above, and only that.
>
> The same applies to **personal phone use, per-diem, lodging and other** expenses: there is no entry screen yet, so **Per-diem / phone / other (attachment)** prints "該当なし" on the demo. The document itself is finished — only the input is missing.
> In each case the calculation and the documents are already in place; adding the screen is what remains.
- **Meal allowance**: a flat amount on days that are **during the tournament** and **exceed 6 worked hours**. Set the amount on Pay Rates (¥0 until set).

---

## 6. Notes

- Each screen opens on a **month that has data**; once you enter data it opens on the current month.
### Demo data is not saved (important)

The demo keeps its database in the server's memory, so **whenever the server stops or restarts, everything entered is lost and it returns to the June 2026 sample.**

- **When**: the free plan sleeps the server after a period of inactivity. The next visit wakes it — already reset. Deploys do the same.
- **What**: not just attendance and expenses, but **stadiums, staff, route fares, pay rates, email settings, any accounts added and any passwords changed** all revert to the sample.
- **Back to**: the June 2026 sample (¥131,300 wage / ¥185,152 net) and the demo logins.

Treat anything entered in the demo as temporary. A walkthrough is most reliable done in one sitting, without long pauses.

> A production deployment uses a permanent database, so **this reset does not happen there**. It is a demo-only limitation.
- The 丙 daily tax table currently covers up to ¥14,800 per day; days above that are estimated, and the screens and payslip label them "**estimate**" (see section 5 — confirm official values).

For questions, contact the vendor (MORABU Hanshin Kogyo).
