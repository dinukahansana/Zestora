import { z } from 'zod';

const positivePort = z.coerce.number().int().min(1).max(65535).default(3001);
const environmentSchema = z.object({
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: positivePort,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().trim().refine(uri => /^mongodb(?:\+srv)?:\/\//.test(uri)).optional(),
  ALLOWED_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173'),
  SITE_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://127.0.0.1:5173'),
  N8N_WEBHOOK_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  N8N_SHARED_SECRET: z.string().min(32).max(500).optional(),
  PAYHERE_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYHERE_MERCHANT_ID: z.string().regex(/^[0-9]{4,15}$/).optional(),
  PAYHERE_MERCHANT_SECRET: z.string().min(12).max(250).optional(),
  PAYHERE_NOTIFY_URL: z.url({ protocol: /^https$/ }).optional(),
  PAYHERE_LIVE_ENABLED: z.enum(['true', 'false']).default('false'),
  PAYHERE_SIMULATOR: z.enum(['true', 'false']).default('false'),
  CLOUDINARY_URL: z.url({ protocol: /^cloudinary$/ }).optional(),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
  MAIL_FROM: z.email().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(4).default(0),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const values = environmentSchema.safeParse({
    ...env,
    PORT: env.PORT || undefined,
    MONGODB_URI: env.MONGODB_URI || undefined,
    CLOUDINARY_URL: env.CLOUDINARY_URL || undefined,
    N8N_WEBHOOK_BASE_URL: env.N8N_WEBHOOK_BASE_URL || undefined,
    N8N_SHARED_SECRET: env.N8N_SHARED_SECRET || undefined,
    PAYHERE_MERCHANT_ID: env.PAYHERE_MERCHANT_ID || undefined,
    PAYHERE_MERCHANT_SECRET: env.PAYHERE_MERCHANT_SECRET || undefined,
    PAYHERE_NOTIFY_URL: env.PAYHERE_NOTIFY_URL || undefined,
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

  const n8nUrl = values.data.N8N_WEBHOOK_BASE_URL ? new URL(values.data.N8N_WEBHOOK_BASE_URL) : undefined;
  if (n8nUrl && (n8nUrl.username || n8nUrl.password || n8nUrl.search || n8nUrl.hash ||
      (values.data.NODE_ENV === 'production' && n8nUrl.protocol !== 'https:'))) {
    throw new Error('N8N_WEBHOOK_BASE_URL must be a webhook base without credentials or query parameters. Production requires HTTPS.');
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
    cloudinaryUrl: values.data.CLOUDINARY_URL,
    n8nBaseUrl: n8nUrl?.href,
    n8nSecret: values.data.N8N_SHARED_SECRET,
    payhereMode: values.data.PAYHERE_MODE,
    payhereMerchant: values.data.PAYHERE_MERCHANT_ID,
    payhereSecret: values.data.PAYHERE_MERCHANT_SECRET,
    payhereNotifyUrl: values.data.PAYHERE_NOTIFY_URL,
    payhereLiveEnabled: values.data.PAYHERE_LIVE_ENABLED === 'true',
    payhereSimulator: values.data.PAYHERE_SIMULATOR === 'true',
    mailFrom: values.data.MAIL_FROM,
  };
}

export type AppConfig = ReturnType<typeof readConfig>;
