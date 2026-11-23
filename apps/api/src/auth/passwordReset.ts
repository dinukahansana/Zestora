import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { HttpError, parseInput } from '../http.ts';
import type { SendEmail } from '../mail.ts';
import { Session, User } from './models.ts';
import { hashPassword } from './passwords.ts';
import { accountEmail, accountPassword } from './routes.ts';

const resetRequest = z.strictObject({ email: accountEmail, language: z.enum(['en', 'si']).default('en') });
const resetInput = z.strictObject({ key: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: accountPassword });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function passwordResetRouter(config: AppConfig, sendEmail?: SendEmail) {
  const router = Router();
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Try again later.')),
  });

  router.post('/forgot-password', limit, async (request, response) => {
    const { email, language } = parseInput(resetRequest, request.body);
    if (!sendEmail) throw new HttpError(503, 'RESET_UNAVAILABLE', 'Password reset email has not been configured.');
    const key = randomBytes(32).toString('base64url');
    const resetHash = hash(key);
    const user = await User.findOneAndUpdate({ email }, {
      $set: { resetHash, resetExpiry: new Date(Date.now() + 30 * 60 * 1000) },
    });
    response.set('Cache-Control', 'no-store').status(202).end();
    if (!user) return;
    const url = new URL('/reset-password', config.siteOrigin);
    url.hash = new URLSearchParams({ key }).toString();
    const subject = language === 'si' ? 'Zestora මුරපදය යළි සකසන්න' : 'Reset your Zestora password';
    const text = language === 'si'
      ? `මුරපදය යළි සැකසීමට මිනිත්තු 30ක් ඇතුළත මෙම සබැඳිය භාවිතා කරන්න.\n${url}`
      : `Use this link within 30 minutes to reset your password.\n${url}`;
    try {
      await sendEmail({ to: user.email, subject, text });
    } catch {
      await User.updateOne({ _id: user._id, resetHash }, { $unset: { resetHash: 1, resetExpiry: 1 } });
      console.error('Reset mail delivery failed.');
    }
  });

  router.post('/reset-password', limit, async (request, response) => {
    const { key, password } = parseInput(resetInput, request.body);
    const resetHash = hash(key);
    const passwordHash = await hashPassword(password);
    await mongoose.connection.transaction(async session => {
      const user = await User.findOneAndUpdate({ resetHash, resetExpiry: { $gt: new Date() } }, {
        $set: { passwordHash }, $unset: { resetHash: 1, resetExpiry: 1 },
      }, { session });
      if (!user) throw new HttpError(400, 'RESET_INVALID', 'This reset link is invalid or has expired.');
      await Session.deleteMany({ userId: user._id }, { session });
    });
    response.set('Cache-Control', 'no-store').status(204).end();
  });
  return router;
}
