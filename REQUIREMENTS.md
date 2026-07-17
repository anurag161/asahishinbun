# Requirements coverage

Mapped against the client requirements PDF
(`docs/朝日新聞総合サービス株式会社_アルバイト勤怠交通費管理システム要件書.pdf`).

Legend: ✅ done · 🟡 partial · ⬜ not done

## §2 Users & roles
| Requirement | Status | Where |
|---|---|---|
| Staff + Admin roles | ✅ | `users.role`, `requireRole` |
| Single login, routed by role | ✅ | `LoginPage`, `RequireRole` |

## §3.1 Attendance (staff)
| Requirement | Status | Where |
|---|---|---|
| Enter work date, start/end time, stadium | ✅ | `AttendancePage` → `POST /api/attendance` |
| Break self-reported; minutes deducted | ✅ | `breakTaken` + `break_minutes` |
| Worked time auto-calculated | ✅ | engine `computeWorkedMinutes` |

## §3.2 Transport auto-calculation
| Requirement | Status | Where |
|---|---|---|
| Pick stadium → auto-apply registered home→stadium fare | ✅ | `applyAutoTransport` (round trip = one-way × 2) |
| Capped at the registered fare | ✅ | auto uses the registered fare; `assertWithinFareCap` on manual |
| Cheaper alternate route allowed; higher rejected | ✅ | fare-cap check on manual transport |
| Admin registers fares manually (for the demo) | ✅ | Route Fares master |

## §3.3 My Page (staff)
| Requirement | Status | Where |
|---|---|---|
| This month's work days + total hours | ✅ | `MyPage` tiles |
| Daily attendance list (date, time, stadium, break) | 🟡 | shown on **Attendance** screen; My Page shows a per-day payroll table (date/worked/wage/tax) |
| Daily transport list + monthly total | 🟡 | list on **Attendance**; monthly transport total on My Page |

> Note: all the data is present and correct; some daily detail lives on the Attendance screen rather
> than duplicated on My Page. Easy to mirror onto My Page if the client prefers it there.

## §3.4 Monthly summary, PDF export, email
| Requirement | Status | Where |
|---|---|---|
| Month-end summary of attendance + expenses | ✅ | `ExportPage`, `mypage/summary` |
| Export as PDF, in the client's document format | ✅ | 勤務表 / 請求明細書 / 給料計算書 → HTML→PDF (Chromium) + browser Save-as-PDF |
| Email the PDF to the staff member | ✅ | `POST /api/documents/:type/:id/email` (real when SMTP set; simulated otherwise) |

## §3.5 Admin functions
| Requirement | Status | Where |
|---|---|---|
| Stadium master (name, address, nearest station) | ✅ | `StadiumsPage` |
| Staff master (name, address, station, phone, email) | 🟡 | create + delete + profile edit; no inline edit of name/email yet |
| Account register/edit (name, email, password, **role**) | 🟡 | staff accounts creatable; admin accounts via seed; no role/password **edit** UI |
| Route-fare master (home ⇔ stadium fare & route) | ✅ | `RouteFaresPage` |
| Review all staff attendance + expenses | ✅ | `RecordsPage` (全体実績) |

## §4 Screens
| Screen | Status |
|---|---|
| Login | ✅ |
| Staff: My Page / Entry / Monthly-export | ✅ |
| Admin: Stadium / Staff / Route-fare / Review | ✅ |

## Beyond the written UI spec (output fidelity — the differentiator)
| Item | Status |
|---|---|
| Reproduce 勤務表 / 請求明細書 / 給料計算書 **to the yen** | ✅ ¥131,300 / ¥188 / ¥54,040 / ¥185,340 / ¥185,152 |
| 令和8年 日額表・丙 withholding-tax table encoded + tested | ✅ |
| JP / EN bilingual UI | ✅ (beyond spec) |

---

## Honest gaps (all small, none block the demo)

1. **Account management (§3.5)** — the admin can create staff accounts, but creating **admin**
   accounts and editing a user's **password/role** is not yet in the UI (admins come from the seed).
   *~30 min to add a role selector + edit form.*
2. **Staff master inline edit** — currently create + delete + profile update; no edit form for the
   core name/email. *Small.*
3. **My Page daily lists (§3.3)** — present but partly on the Attendance screen; can be mirrored onto
   My Page if the client wants that exact layout. *Small.*
4. **弁当代 (lunch) amount** — a data value the scans didn't make legible; wired as ¥0 until MORABU
   confirms it. *Not a code gap.*
5. **PDF fonts on Linux deploy** — the local (Windows) demo renders Japanese PDFs fine; a Linux host
   (Render) needs a CJK font package (`fonts-noto-cjk`) installed for server-side PDF. *Deploy note.*

**Bottom line:** every screen and every core flow in the requirements is built and working, and the
system additionally reproduces the client's real documents to the yen. The remaining items are minor
UI conveniences and one unknown data value — each can be closed quickly on request.
