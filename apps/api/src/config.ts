import { z } from 'zod';

const positivePort = z.coerce.number().int().min(1).max(65535).default(3001);
const environmentSchema = z.object({
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: positivePort,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().trim().refine(uri => /^mongodb(?:\+srv)?:\/\//.test(uri)).optional(),
  ALLOWED_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173'),
  SITE_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://127.0.0.1:5173'),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
  MAIL_FROM: z.email().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(4).default(0),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const values = environmentSchema.safeParse({
    ...env,
    PORT: env.PORT || undefined,
    MONGODB_URI: env.MONGODB_URI || undefined,
    SMTP_URL: env.SMTP_URL || undefined,
    MAIL_FROM: env.MAIL_FROM || undefined,
  });
  if (!values.success) {
    throw new Error(`Invalid environment settings: ${values.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  }

  const allowedOrigins = values.data.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    const parsed = URL.parse(origin);
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || origin !== parsed.origin) {
      throw new Error('ALLOWED_ORIGINS must contain HTTP origins with no path.');
    }
  }

  return {
    host: values.data.HOST,
    port: values.data.PORT,
    mongoUri: values.data.MONGODB_URI,
    secureCookies: values.data.NODE_ENV === 'production',
    trustProxyHops: values.data.TRUST_PROXY_HOPS,
    allowedOrigins,
    siteOrigin: new URL(values.data.SITE_ORIGIN).origin,
    smtpUrl: values.data.SMTP_URL,
    mailFrom: values.data.MAIL_FROM,
  };
}

export type AppConfig = ReturnType<typeof readConfig>;
