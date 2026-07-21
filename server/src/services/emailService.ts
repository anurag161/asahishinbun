/**
 * Email delivery (requirements §3.4 — email the monthly PDF to the staff member).
 *
 * Three tiers, chosen automatically:
 *   1. `smtp`     — real credentials in SMTP_* (Brevo 300/day, or a Gmail app
 *                   password). Delivers to the real inbox.
 *   2. `ethereal` — no credentials: use Ethereal (https://ethereal.email), a
 *                   free, no-signup test SMTP. The message is really sent and
 *                   viewable at a returned preview URL — so the demo "just works"
 *                   without anyone configuring secrets.
 *   3. `capture`  — Ethereal unreachable (offline): fall back to capturing the
 *                   message so the flow still completes.
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

export type DeliveryMode = 'smtp' | 'ethereal' | 'capture';

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

async function makeTransport(): Promise<{ transporter: Transporter; mode: DeliveryMode }> {
  if (config.smtp.user && config.smtp.pass) {
    return {
      mode: 'smtp',
      transporter: nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
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
      }),
    };
  } catch {
    // Offline / Ethereal unreachable: capture instead of sending.
    return { mode: 'capture', transporter: nodemailer.createTransport({ jsonTransport: true }) };
  }
}

export function createMailer(): Mailer {
  const configured = Boolean(config.smtp.user && config.smtp.pass);
  // Transport is created lazily on first send (Ethereal setup is async / networked).
  let ready: Promise<{ transporter: Transporter; mode: DeliveryMode }> | null = null;
  const init = () => {
    if (!ready) ready = makeTransport();
    return ready;
  };

  return {
    live: configured,
    async send(message: EmailMessage): Promise<SendResult> {
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
