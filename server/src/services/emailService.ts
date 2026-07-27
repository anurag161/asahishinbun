/**
 * Email delivery (requirements §3.4 — email the monthly PDF to the staff member).
 *
 * Tiers, chosen automatically (first configured wins):
 *   1. `api`      — BREVO_API_KEY or RESEND_API_KEY set: deliver over HTTPS.
 *   2. `smtp`     — SMTP_* set: a normal mail server on port 587/465.
 *   3. `ethereal` — nothing configured: Ethereal (https://ethereal.email), a
 *                   free no-signup test SMTP. Really sent, viewable at a preview
 *                   URL, so the demo works without anyone configuring secrets.
 *   4. `capture`  — nothing reachable: capture the message so the flow completes.
 *
 * Why an HTTPS tier exists at all: hosts commonly block outbound SMTP to stop
 * spam, and Render's free instances block ports 25, 465 AND 587 outright. Every
 * SMTP option therefore dies the same way there — a connection timeout — no
 * matter which provider's credentials you use. Port 443 is not blocked, so an
 * HTTP API is the only path that delivers from that kind of host. Brevo and
 * Resend both expose one; Brevo is first so an existing Brevo account (its
 * SMTP creds work locally) keeps working in production by adding one API key.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export type DeliveryMode = 'api' | 'smtp' | 'ethereal' | 'capture';

export interface SendResult {
  messageId: string;
  mode: DeliveryMode;
  /** For `ethereal`: a browser URL to view the sent message. */
  previewUrl?: string;
}

export interface Mailer {
  /** True only when real SMTP credentials are configured (delivers to a real inbox). */
  readonly live: boolean;
  send(message: EmailMessage): Promise<SendResult>;
}

/**
 * A blocked outbound port shows up as a stalled connection, not a refusal, so
 * without these the request hangs for ~2 minutes before failing. Fail fast and
 * report the reason instead.
 */
const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
} as const;

/** Split "Name <email>" (or a bare address) into Brevo's structured sender. */
function parseSender(from: string): { email: string; name?: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (m && m[2]) return { email: m[2].trim(), name: m[1] || undefined };
  return { email: from.trim() };
}

/**
 * Deliver over HTTPS via Brevo's transactional API. Works where outbound SMTP is
 * blocked (Render free). The sender address must be a verified sender/domain in
 * the Brevo account, or Brevo rejects it with a 400.
 */
async function sendViaBrevo(message: EmailMessage): Promise<SendResult> {
  const attachments = message.attachments ?? [];
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(config.smtp.from),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      attachment: attachments.length
        ? attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') }))
        : undefined,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    messageId?: string;
    message?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new Error(
      `Brevo rejected the message (${res.status}): ${body.message ?? body.code ?? 'unknown error'}`,
    );
  }
  return { messageId: body.messageId ?? 'brevo', mode: 'api' };
}

/** Deliver over HTTPS via Resend. Works where outbound SMTP ports are blocked. */
async function sendViaResend(message: EmailMessage): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.smtp.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      attachments: (message.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Resend rejected the message (${res.status}): ${body.message ?? 'unknown error'}`);
  }
  return { messageId: body.id ?? 'resend', mode: 'api' };
}

async function makeTransport(): Promise<{ transporter: Transporter; mode: DeliveryMode }> {
  if (config.smtp.user && config.smtp.pass) {
    return {
      mode: 'smtp',
      transporter: nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
        ...SMTP_TIMEOUTS,
      }),
    };
  }

  // No real credentials → Ethereal: a free, no-signup test SMTP that actually
  // accepts the message and gives back a viewable preview URL.
  try {
    const test = await nodemailer.createTestAccount();
    return {
      mode: 'ethereal',
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: test.user, pass: test.pass },
        ...SMTP_TIMEOUTS,
      }),
    };
  } catch {
    // Offline / Ethereal unreachable: capture instead of sending.
    return { mode: 'capture', transporter: nodemailer.createTransport({ jsonTransport: true }) };
  }
}

export function createMailer(): Mailer {
  const configured = Boolean(
    config.brevoApiKey || config.resendApiKey || (config.smtp.user && config.smtp.pass),
  );
  // Transport is created lazily on first send (Ethereal setup is async / networked).
  let ready: Promise<{ transporter: Transporter; mode: DeliveryMode }> | null = null;
  const init = () => {
    if (!ready) ready = makeTransport();
    return ready;
  };

  return {
    live: configured,
    async send(message: EmailMessage): Promise<SendResult> {
      // HTTPS first — the only tier that survives a host with SMTP blocked.
      if (config.brevoApiKey) return sendViaBrevo(message);
      if (config.resendApiKey) return sendViaResend(message);

      const { transporter, mode } = await init();
      const info = await transporter.sendMail({
        from: config.smtp.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        attachments: message.attachments,
      });
      const previewUrl =
        mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) || undefined : undefined;
      return { messageId: String(info.messageId ?? 'captured'), mode, previewUrl };
    },
  };
}
