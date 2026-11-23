import nodemailer from 'nodemailer';
import type { AppConfig } from './config.ts';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export type SendEmail = (message: Email) => Promise<void>;

export function createMailer(config: AppConfig): SendEmail | undefined {
  if (!config.smtpUrl || !config.mailFrom) return undefined;
  const from = config.mailFrom;
  const url = new URL(config.smtpUrl);
  const secure = url.protocol === 'smtps:';
  const transport = nodemailer.createTransport({
    host: url.hostname,
    port: url.port ? Number(url.port) : secure ? 465 : 587,
    secure,
    requireTLS: !secure,
    auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined,
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 10000,
  });
  return async message => {
    await transport.sendMail({ from: { address: from, name: 'Zestora' }, ...message });
  };
}
