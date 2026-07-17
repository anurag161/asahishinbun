# Deployment

Everything here is free-tier. Two ways to run it.

## A. Zero-setup demo (no database, no accounts)

For local review or a screen-recording — the fastest path.

```bash
npm install
npm run demo        # builds everything, then serves the whole app on :4000
```

Open **http://localhost:4000** and sign in:

| Role | Email | Password |
|---|---|---|
| Staff | staff@example.com | staff123 |
| Admin | admin@example.com | admin123 |

It runs on an **in-memory Postgres** seeded with the June 2026 sample, so it opens
correct-to-the-yen. Data resets when the process restarts. No `.env` needed.

(For hot-reload development instead: `npm run dev` — server on :4000, client on :5173.)

## B. Hosted demo (persistent, free tier)

Single web service that serves both the API and the built client, plus a free Postgres.

### 1. Database — Neon (free)
1. Create a project at https://neon.tech and copy the connection string
   (`postgresql://…?sslmode=require`).

### 2. Web service — Render (free)
Create a **Web Service** from the repo with:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run migrate && npm run seed && npm start`
  (drop `seed` after the first deploy if you don't want it reset each boot)
- **Environment variables:**

  | Key | Value |
  |---|---|
  | `DATABASE_URL` | the Neon connection string |
  | `JWT_SECRET` | any long random string |
  | `NODE_ENV` | `production` |
  | `CLIENT_URL` | the Render URL (for CORS) |

Because the server serves `client/dist`, one Render service hosts the whole app —
no separate frontend deploy needed. (Render free spins down when idle; the first
request after inactivity takes ~30s to wake.)

### 3. PDF (optional)
Server-side PDF (email attachments, `format=pdf`) needs Chromium:

```bash
npm i puppeteer -w server
```

Add it before deploying if you want emailed PDFs. Without it, the in-app document
view + browser "Save as PDF" still works everywhere, and email sends the HTML.

### 4. Email (optional)
To actually send (not just capture) the monthly document email, set SMTP — free via
Brevo (300/day) or a Gmail app password:

| Key | Value |
|---|---|
| `SMTP_HOST` | e.g. `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` / `SMTP_PASS` | provider credentials |
| `SMTP_FROM` | `Asahi Payroll <no-reply@yourdomain>` |

Without these, the email endpoint captures the message and reports `delivery: "captured"`.

## Cost

| Service | Plan | Cost |
|---|---|---|
| Neon Postgres | Free | $0 |
| Render web service | Free | $0 |
| Brevo / Gmail SMTP | Free | $0 |
| **Total** | | **$0** |
