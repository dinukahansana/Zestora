import cors from 'cors';
import { aiProvider } from './ai/provider.ts';
import { aiRoutes } from './ai/routes.ts';
import { aiRunner } from './ai/runner.ts';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import { createImageUploader, type UploadImage } from './admin/images.ts';
import { adminRouter } from './admin/routes.ts';
import { storefrontSettingsRouter } from './admin/settings.ts';
import { automationRouter } from './automation/routes.ts';
import { authRouter } from './auth/routes.ts';
import { passwordResetRouter } from './auth/passwordReset.ts';
import { profileRouter } from './auth/profile.ts';
import { catalogueRouter } from './catalogue/routes.ts';
import type { AppConfig } from './config.ts';
import { databaseReady } from './database.ts';
import { errorHandler, HttpError, notFound } from './http.ts';
import { createMailer, type SendEmail } from './mail.ts';
import { orderingRouter } from './ordering/routes.ts';
import { paymentsRouter } from './payments/routes.ts';
import { mountStorefront } from './storefront.ts';

export function createApp(
  config: AppConfig,
  sendEmail: SendEmail | undefined = createMailer(config),
  uploadImage: UploadImage | undefined = createImageUploader(config),
) {
  const app = express();
  const provider = aiProvider(config);
  const runner = aiRunner(config, provider);
  const ai = aiRoutes(config, runner, provider);
  if (config.trustProxyHops) app.set('trust proxy', config.trustProxyHops);
  app.disable('x-powered-by');
  app.use(helmet(config.serveWeb ? {
    contentSecurityPolicy: { directives: {
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      formAction: ["'self'", 'https://sandbox.payhere.lk', 'https://www.payhere.lk'],
      upgradeInsecureRequests: config.secureCookies ? [] : null,
    } },
  } : {}));
  app.use(cors({
    origin: (origin, done) => done(null, Boolean(origin && config.allowedOrigins.includes(origin))),
    credentials: true,
  }));
  app.use((request, _response, next) => {
    const origin = request.get('origin');
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (unsafe && ((origin && !config.allowedOrigins.includes(origin)) || (!origin && request.get('sec-fetch-site') === 'cross-site'))) {
      next(new HttpError(403, 'ORIGIN_FORBIDDEN', 'This origin cannot modify Zestora records.'));
      return;
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'zestora-api' });
  });
  app.get('/api/ready', (_request, response) => {
    const ready = databaseReady();
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable', database: ready ? 'connected' : 'disconnected' });
  });

  const api = express.Router();
  const requireDatabase: RequestHandler = (_request, _response, next) => {
    if (databaseReady()) next();
    else next(new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is unavailable.'));
  };
  api.use('/auth', requireDatabase, authRouter(config), passwordResetRouter(config, sendEmail));
  api.use('/account', requireDatabase, profileRouter(config));
  api.use(['/shop/checkout', '/orders'], requireDatabase);
  api.use(orderingRouter(config, sendEmail));
  api.use('/payments', requireDatabase, paymentsRouter(config, sendEmail));
  api.use('/integrations/n8n', requireDatabase, automationRouter(config, sendEmail, provider), runner.router);
  api.use('/admin/ai', requireDatabase, ai.admin);
  api.use('/admin', requireDatabase, adminRouter(config, uploadImage, sendEmail));
  api.use('/shop/storefront', requireDatabase);
  api.use(storefrontSettingsRouter);
  api.use(['/catalogue', '/products', '/categories', '/ai', '/reviews'], requireDatabase);
  api.use(ai.router);
  api.use(catalogueRouter);
  app.use('/api', api, notFound);
  if (config.serveWeb) mountStorefront(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
