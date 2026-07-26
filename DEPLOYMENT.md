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

## B. Hosted demo — Render (free)

One web service serves the API and the built client. Two ways to set it up.

### B1. Blueprint (recommended — nothing to type)

Render dashboard → **New** → **Blueprint** → pick this repo. It reads
[`render.yaml`](./render.yaml), which already supplies the build command, start
command, health check and env. Nothing to fill in by hand.

This runs in **demo mode**: no `DATABASE_URL`, so the server boots the in-memory
database seeded with the June 2026 sample. No Neon project needed to put a URL in
front of someone. Data resets whenever the service restarts.

### B2. Manual web service

If you create the service by hand instead, both commands need care:

- **Build command:** `npm install --include=dev && npm run build`
- **Start command:** `npm start`

> **`--include=dev` is required.** `NODE_ENV=production` makes npm skip
> `devDependencies`, and `tsc`, `vite` and every `@types/*` package live there —
> so a plain `npm install` installs 172 packages, omits the compiler, and the
> build dies on `error TS7016: Could not find a declaration file for 'express'`.
>
> **Do not chain `npm run migrate` into the start command** unless `DATABASE_URL`
> is set. Without it, `migrate` exits non-zero, and because the chain is `&&`,
> `npm start` never runs — the service never boots and Render serves its
> "Application failed to respond" page rather than the UI.

- **Environment variables:**

  | Key | Value |
  |---|---|
  | `JWT_SECRET` | any long random string (**required** — the server refuses to boot without it in production) |
  | `NODE_ENV` | `production` |
  | `CLIENT_URL` | the Render URL (for CORS) |
  | `DATABASE_URL` | *(optional)* a Neon connection string — see below |

### Persistent database (optional)

Demo mode loses data on restart. For persistence, create a project at
https://neon.tech, copy the connection string (`postgresql://…?sslmode=require`),
set it as `DATABASE_URL`, and change the start command to:

```
npm run migrate && npm start
```

Migrations are tracked in `schema_migrations` and are idempotent, so this is safe
to run on every boot. Add `npm run seed` once if you want the June 2026 sample
data in the Neon database too.

Because the server serves `client/dist`, one Render service hosts the whole app —
no separate frontend deploy needed. (Render free spins down when idle; the first
request after inactivity takes ~30s to wake.)

### If the deploy shows no UI

The server only serves the client when `client/dist/index.html` exists at
runtime, so "API works but no UI" means the client build did not run. Check the
Render **build** log for the `vite build` step. If it is missing or the build
failed on `tsc`, the build command is missing `--include=dev`.

If the page is Render's own error page instead, the service never started —
check the **runtime** log for a failed `migrate` or a missing `JWT_SECRET`.

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
