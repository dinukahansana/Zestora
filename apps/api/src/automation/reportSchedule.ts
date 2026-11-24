import { createHash, timingSafeEqual } from 'node:crypto';
import { currentShop } from '../admin/settings.ts';
import { createReport } from '../ai/business.ts';
import { AiRun, BusinessReport } from '../ai/models.ts';
import type { AiProvider } from '../ai/provider.ts';
import { isDuplicateKey } from '../http.ts';

const colomboOffset = (5 * 60 + 30) * 60000;
const day = 86400000;

export function closedReportWindows(now = new Date()) {
  const local = new Date(now.getTime() + colomboOffset);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const today = Date.UTC(year, month, local.getUTCDate());
  const monday = today - ((local.getUTCDay() + 6) % 7) * day;
  const window = (period: 'day' | 'week' | 'month', first: number, boundary: number) => ({
    period, start: new Date(first - colomboOffset), end: new Date(boundary - colomboOffset),
    key: period + ':' + new Date(first).toISOString().slice(0, 10),
  });
  return [
    window('day', today - day, today),
    window('week', monday - 7 * day, monday),
    window('month', Date.UTC(year, month - 1, 1), Date.UTC(year, month, 1)),
  ];
}

export function authorizedSchedule(supplied: string, key: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(key));
}

export async function saveScheduledReports(provider: AiProvider, now = new Date()) {
  const shop = await currentShop();
  const saved: string[] = [];
  for (const { period, start, end, key } of closedReportWindows(now)) {
    if (await BusinessReport.exists({ scheduleKey: key })) continue;
    const requestId = 'scheduled-report:' + key;
    let claim;
    try {
      claim = await AiRun.create({ requestId, state: 'running', expiresAt: new Date(Date.now() + 120000) });
    } catch (error) {
      if (isDuplicateKey(error)) continue;
      throw error;
    }
    try {
      if (await BusinessReport.exists({ scheduleKey: key })) continue;
      await createReport(period, shop.presentation.defaultLanguage, { complete: provider.generate }, { key, start, end });
      saved.push(key);
    } finally {
      await AiRun.deleteOne({ _id: claim._id });
    }
  }
  return { saved };
}
