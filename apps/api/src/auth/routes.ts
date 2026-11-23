import { createHash, randomBytes } from 'node:crypto';
import { Router, type CookieOptions, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose, { type Types } from 'mongoose';
import { z } from 'zod';
import { recordEvent } from '../automation/events.ts';
import type { AppConfig } from '../config.ts';
import { HttpError, isDuplicateKey, parseInput } from '../http.ts';
import { Session, User, type Role } from './models.ts';
import { dummyHash, hashPassword, verifyPassword } from './passwords.ts';

export const accountName = z.string().trim().min(2).max(100);
export const accountEmail = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const accountPassword = z.string().min(12).max(128);

const registerInput = z.strictObject({ name: accountName, email: accountEmail, password: accountPassword });
const loginInput = z.strictObject({ email: accountEmail, password: z.string().min(1).max(128) });
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function publicUser(user: { _id: Types.ObjectId; email: string; name: string; role: Role }) {
  return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
}

export function sessionAccess(config: AppConfig) {
  const name = config.secureCookies ? '__Host-zestora-session' : 'zestora-session';
  const attributes: CookieOptions = {
    httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/',
  };

  function tokenHash(request: Request) {
    for (const cookie of request.headers.cookie?.split(';') ?? []) {
      const [key, token] = cookie.trim().split('=');
      if (key === name && /^[A-Za-z0-9_-]{43}$/.test(token ?? '')) return digest(token);
    }
    return undefined;
  }

  async function issue(request: Request, response: Response, userId: Types.ObjectId) {
    const token = randomBytes(32).toString('base64url');
    const previousHash = tokenHash(request);
    await Session.create({ userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + sessionLifetimeMs) });
    if (previousHash) await Session.deleteOne({ tokenHash: previousHash });
    response.cookie(name, token, { ...attributes, maxAge: sessionLifetimeMs });
  }

  async function current(request: Request) {
    const hash = tokenHash(request);
    if (!hash) return null;
    const session = await Session.findOne({ tokenHash: hash, expiresAt: { $gt: new Date() } }).lean();
    return session ? User.findById(session.userId) : null;
  }

  async function requireUser(request: Request, role?: Role) {
    const user = await current(request);
    if (!user) throw new HttpError(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
    if (role && user.role !== role) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
    return user;
  }

  async function clear(request: Request, response: Response) {
    const hash = tokenHash(request);
    if (hash) await Session.deleteOne({ tokenHash: hash });
    response.clearCookie(name, attributes);
  }

  return { current, requireUser, issue, clear };
}

export function authRouter(config: AppConfig) {
  const router = Router();
  const sessions = sessionAccess(config);
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Try again later.')),
  });

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/register', limit, async (request, response) => {
    const { name, email, password } = parseInput(registerInput, request.body);
    const passwordHash = await hashPassword(password);
    try {
      const user = await mongoose.connection.transaction(async session => {
        const account = await new User({ name, email, passwordHash, role: 'customer' }).save({ session });
        await recordEvent('customer.registered', account._id.toString(), {}, session);
        return account;
      });
      await sessions.issue(request, response, user._id);
      response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (isDuplicateKey(error)) throw new HttpError(409, 'ACCOUNT_EXISTS', 'An account already uses that email address.');
      throw error;
    }
  });

  router.post('/login', limit, async (request, response) => {
    const { email, password } = parseInput(loginInput, request.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new HttpError(401, 'INVALID_LOGIN', 'The email or password is incorrect.');
    await sessions.issue(request, response, user._id);
    response.json({ user: publicUser(user) });
  });

  router.post('/logout', async (request, response) => {
    await sessions.clear(request, response);
    response.status(204).end();
  });

  router.get('/me', async (request, response) => {
    const user = await sessions.requireUser(request);
    response.json({ user: publicUser(user) });
  });
  return router;
}
