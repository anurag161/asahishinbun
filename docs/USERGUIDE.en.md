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
2. **Break (hours)**: tick the box and enter the break in **hours** (e.g. 1 = one hour, 0.5 = 30 min).
3. **Meal allowance**: choose `○ (yes)` or `× (no)`.
   - Selectable **only when the day's worked time exceeds 6 hours**. On days of 6 hours or less it is disabled and shows "Not eligible (worked ≤ 6h)".
4. Press **Add work day**.
   - If a **route fare is registered** between the home station and the stadium station, the **round-trip transport is applied automatically**. If not, only the day is saved; transport appears once an admin registers the route.

**Registered days** (table):

- Columns: date, stadium, start, end, worked, **Meal allowance (○/×)**.
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

On each document card:

- **View** — render it below the cards
- **PDF** — open the PDF in a new tab (save from there)
- **Email** — send it, with the PDF attached, to your registered address (or the admin's test address, if set)
- The document on screen can also be saved via **Print / Save as PDF**.

---

## 4. Admin

Top menu: **All Records / Stadiums / Staff / Accounts / Route Fares / Pay Rates / Email Settings**

### 4-1. All Records

Monthly totals for every staff member (work days, worked, salary, transport, tax, net pay, **meal allowance**).

- The **meal-allowance** column is qualifying days (○) × the **Pay Rates meal amount**. While the amount is unset (¥0) it shows ¥0.
- **Details** on a row opens that person's **per-day breakdown**. There you can re-tag each day as **Tournament (direct) / Editorial (indirect)** — its transport moves to the same bucket. The **Meal allowance (○/×)** is shown too.

### 4-2. Masters

| Screen | Content |
|---|---|
| Stadiums | Name, address, nearest station |
| Staff | Name, postal code, address, home nearest station, phone |
| Route Fares | **One-way fare** between a home station and a stadium station (drives auto transport) |
| Pay Rates | Hourly, overtime (≤60h / >60h), night premium, **meal allowance (flat)** |
| Accounts | Create accounts, change roles, reset passwords, delete |

**The meal-allowance amount** is entered on **Pay Rates**. It starts at **¥0**. Enter an amount and save, and it is added to the wage on qualifying (○) days and flows into the documents and All Records.

### 4-3. Email Settings

For confirming that document email is delivered.

- Set a **test recipient address** and every document email goes there instead of each staff member's own address (no registered address is changed).
- **Send test** sends a throwaway message.
- Clear the field and save to restore normal delivery to each staff member.

---

## 5. How the figures are calculated (reference)

- **Salary**: sum of "worked hours × hourly rate" for each day (plus taxable expenses).
- **Withholding tax**: looked up **per day** in the daily table (category 丙) and summed — not applied to the monthly total. It starts once a day's taxable amount exceeds about ¥9,800.
- **Transport**: registered **one-way fare × 2 (round trip) × work days**. Non-taxable.
- **Meal allowance**: a flat amount on days that are **during the tournament** and **exceed 6 worked hours**. Set the amount on Pay Rates (¥0 until set).

---

## 6. Notes

- Each screen opens on a **month that has data**; once you enter data it opens on the current month.
- The demo environment resets its data when the server restarts, returning to the sample (June 2026).
- The 丙 daily tax table currently covers up to ¥14,800 per day; days above that are estimated provisionally (confirm official values).

For questions, contact the vendor (MORABU Hanshin Kogyo).
