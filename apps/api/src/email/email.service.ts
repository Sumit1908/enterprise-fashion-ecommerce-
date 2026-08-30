import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@slay/config';

const env = loadEnv();

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: string;
  reason?: string;
  id?: string;
}

/**
 * Transactional email. Resolves a transport from the environment:
 *   - RESEND_API_KEY set            -> Resend HTTPS API (no extra dependency)
 *   - SMTP_HOST + SMTP_USER set     -> SMTP via nodemailer
 *   - nothing configured           -> logs the message and reports not delivered
 *
 * Nothing here throws on a delivery failure; callers treat email as best-effort.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransport: unknown;

  get configured(): boolean {
    return Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER));
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const text = input.text ?? stripHtml(input.html);
    try {
      if (env.RESEND_API_KEY) return await this.sendViaResend(input, text);
      if (env.SMTP_HOST && env.SMTP_USER) return await this.sendViaSmtp(input, text);
    } catch (err) {
      this.logger.error(`Email delivery failed: ${(err as Error).message}`);
      return { delivered: false, provider: 'error', reason: (err as Error).message };
    }
    this.logger.warn(
      `Email not sent (no transport configured): "${input.subject}" -> ${input.to}`,
    );
    return { delivered: false, provider: 'none', reason: 'no email transport configured' };
  }

  private async sendViaResend(input: SendEmailInput, text: string): Promise<SendEmailResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: string };
    return { delivered: true, provider: 'resend', id: data.id };
  }

  private async sendViaSmtp(input: SendEmailInput, text: string): Promise<SendEmailResult> {
    const transport = await this.getSmtpTransport();
    const info = (await (
      transport as { sendMail: (o: unknown) => Promise<{ messageId: string }> }
    ).sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
      replyTo: input.replyTo,
    })) as { messageId: string };
    return { delivered: true, provider: 'smtp', id: info.messageId };
  }

  private async getSmtpTransport(): Promise<unknown> {
    if (this.smtpTransport) return this.smtpTransport;
    const nodemailer = await import('nodemailer');
    this.smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    return this.smtpTransport;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
