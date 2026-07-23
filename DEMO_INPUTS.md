# デモ入力データ / Demo Input Data

Copy-paste values for the manager demo. One self-consistent set — the stadium's
station, the staff's home station, and the fare all match, so auto-transport fires.
All new names, no clash with the seeded data.

---

## 起動 / Start the server

```
DEMO_STAFF_EMAIL=anuragkumar.bh@gmail.com npm run demo
```

Open: <http://localhost:4000> · keep language on **日本語** (top-right).

## ログイン / Logins

| Role | Email | Password |
|------|-------|----------|
| 管理者 / Admin | `admin@example.com` | `admin123` |
| アルバイト / Staff | `anuragkumar.bh@gmail.com` | `staff123` |

---

## 04 · 球場マスタ / Add stadium
`球場マスタ → 追加 → 保存`

| Field | Value |
|-------|-------|
| 球場名 | 横浜スタジアム |
| 住所 | 神奈川県横浜市中区横浜公園 |
| 最寄り駅 | 関内 |

## 05 · アルバイトマスタ / Add staff
`アルバイトマスタ → 追加 → 保存`

| Field | Value |
|-------|-------|
| 氏名 | 山本 陽子 |
| メール | yamamoto.yoko@example.com |
| パスワード | staff123 |
| 自宅最寄り駅 | 桜木町 |
| 住所 | 神奈川県横浜市西区 |
| 電話番号 | 090-3333-0007 |

## 06 · 区間別交通費 / Add fare — enter BOTH directions
`区間別交通費 → 追加`  (経路メモ auto-fills)

| # | 出発駅 | 到着駅 | 片道運賃 | 交通手段 |
|---|--------|--------|----------|----------|
| ① | 桜木町 | 関内 | 160 | 電車 |
| ② | 関内 | 桜木町 | 160 | 電車 |

Round trip = 160 × 2 = **¥320/day** for 山本陽子.

> ⚠️ Station names must match **exactly** between the stadium's 最寄り駅 and the route.
> If they differ, the day still saves but transport is ¥0 ("交通費は未計上").

## 07 · 勤怠・交通費入力 / Enter a workday
Log in as **山本陽子** → `勤怠・交通費入力 → 勤務日を追加`

| Field | Value |
|-------|-------|
| 勤務日 | 2026-07-23 |
| 球場 | 横浜スタジアム |
| 始業 | 09:00 |
| 終業 | 18:00 |
| 休憩 | あり / 60 分 |

→ Toast: **交通費 ¥320 を自動計上しました**

> One work day per date. If you see "すでに登録されています", pick a fresh date
> or delete the existing row with 削除.

## ＋ Optional · アカウント管理 / Add account
`アカウント管理 → 追加`

| Field | Value |
|-------|-------|
| 氏名 | 中村 誠 |
| メール | nakamura.makoto@example.com |
| パスワード | staff123 |
| 権限 | アルバイト |

---

## Alternative: show the ready-made ¥185,152 month

Skip creating a new staff — the seeded sample staff already has a full, correct
June. This is the stronger "it's accurate" moment.

1. Log in as `anuragkumar.bh@gmail.com` / `staff123`.
2. Set the month picker to **2026-06** (today is July, so pages open empty otherwise).
3. (Optional) Add a day at **大阪球場（サンプル）** on **2026-06-30**, 09:00–18:00, 休憩60
   → auto-transport **¥3,860**.
4. マイページ shows: 給料 **¥131,300** · 交通費 **¥54,040** · 所得税 **¥188** · 差引支給額 **¥185,152**.
5. 月次実績・書類 → 表示 the 勤務表 / 請求明細書 / 給料計算書, then メール送信 to your inbox.
