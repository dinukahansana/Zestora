import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { HttpError, isDuplicateKey, parseInput } from '../http.ts';
import { AiRun } from './models.ts';
import type { AiProvider } from './provider.ts';

const workflow = {
  assistant: 'zestora-ai-assistant',
  recommendations: 'zestora-product-recommendations',
  reporting: 'zestora-business-report',
  marketing: 'zestora-marketing-draft',
} as const;
type Feature = keyof typeof workflow;
const taskSchema = z.strictObject({
  requestId: z.uuid(), feature: z.enum(['assistant', 'recommendations', 'reporting', 'marketing']),
  rule: z.string().min(1).max(2500), data: z.json(),
});
type Task = z.infer<typeof taskSchema>;

function serialized(task: Task) {
  return JSON.stringify({ requestId: task.requestId, feature: task.feature, rule: task.rule, data: task.data });
}

function signature(task: Task, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`ai.${timestamp}.${serialized(task)}`).digest('hex');
}

export function aiRunner(config: AppConfig, provider: AiProvider) {
  async function complete<T>(feature: Feature, rule: string, data: z.infer<ReturnType<typeof z.json>>, result: z.ZodType<T>): Promise<T | undefined> {
    if (!provider.enabled) return;
    if (!config.n8nBaseUrl || !config.n8nSecret) return provider.generate(feature, rule, data, result);

    const task: Task = { requestId: randomUUID(), feature, rule, data };
    const now = String(Math.floor(Date.now() / 1000));
    try {
      const endpoint = new URL(workflow[feature], config.n8nBaseUrl.endsWith('/') ? config.n8nBaseUrl : config.n8nBaseUrl + '/');
      const response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(11000),
        headers: { 'Content-Type': 'application/json', 'X-Zestora-Timestamp': now, 'X-Zestora-Signature': signature(task, now, config.n8nSecret) },
        body: serialized(task),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return;
      }
      return z.object({ result }).parse(await response.json()).result;
    } catch {
      return;
    }
  }

  const router = Router();
  router.post('/ai', async (request, response) => {
    if (!config.n8nSecret) throw new HttpError(404, 'NOT_FOUND', 'This integration is unavailable.');
    const task = parseInput(taskSchema, request.body);
    const timestamp = request.get('x-zestora-timestamp') ?? '';
    const supplied = request.get('x-zestora-signature') ?? '';
    if (!/^\d{10}$/.test(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 60 ||
        !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(signature(task, timestamp, config.n8nSecret), 'hex'))) {
      throw new HttpError(403, 'INVALID_EVENT_SIGNATURE', 'This AI task could not be verified.');
    }
    try {
      await AiRun.create({ requestId: task.requestId, state: 'running', expiresAt: new Date(Date.now() + 300000) });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const existing = await AiRun.findOne({ requestId: task.requestId }).lean();
      if (existing?.state === 'done') {
        response.json({ result: existing.result });
        return;
      }
      throw new HttpError(409, 'AI_TASK_EXISTS', 'This AI task has already started.');
    }
    const result = await provider.generate(task.feature, task.rule, task.data, z.json());
    await AiRun.updateOne({ requestId: task.requestId }, { $set: { state: result === undefined ? 'failed' : 'done', result } });
    if (result === undefined) throw new HttpError(503, 'AI_UNAVAILABLE', 'AI generation is unavailable.');
    response.set('Cache-Control', 'no-store').json({ result });
  });
  return { complete, router };
}

export type AiRunner = ReturnType<typeof aiRunner>;
