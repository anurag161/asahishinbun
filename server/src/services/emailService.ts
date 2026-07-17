/**
 * Email delivery (requirements §3.4 — email the monthly PDF to the staff member).
 *
 * Uses nodemailer. When SMTP isn't configured (dev/test), it falls back to a
 * jsonTransport that captures the message instead of sending — so the flow works
 * end-to-end without credentials. Free options for real sending: Brevo SMTP
 * (300/day) or a Gmail app password.
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

export interface Mailer {
  /** True when a real SMTP transport is configured. */
  readonly live: boolean;
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

function makeTransport(): { transporter: Transporter; live: boolean } {
  if (config.smtp.user && config.smtp.pass) {
    return {
      live: true,
      transporter: nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      }),
    };
  }
  // No credentials: capture messages instead of sending.
  return { live: false, transporter: nodemailer.createTransport({ jsonTransport: true }) };
}

export function createMailer(): Mailer {
  const { transporter, live } = makeTransport();
  return {
    live,
    async send(message: EmailMessage) {
      const info = await transporter.sendMail({
        from: config.smtp.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        attachments: message.attachments,
      });
      return { messageId: String(info.messageId ?? 'captured') };
    },
  };
}
