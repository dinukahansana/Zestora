import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, send } from '../commerce/api';
import { formatPrice, type LocalText } from '../content/catalogue';
import { languageOf } from '../i18n';
import { Panel, valueOf } from './Fields';

interface Report {
  _id: string;
  period: string;
  metrics: { totals: { revenue: number; paidOrders: number }; rows: { period: string; revenue: number; paidOrders: number }[] };
  summary: string;
  insights: string[];
  source: string;
}
interface Draft { _id: string; type: string; content: string; source: string; status: string; language: 'en' | 'si' }
interface Counts { _id: string; count: number }

export function InsightsAdmin() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [period, setPeriod] = useState('day');
  const reports = useQuery({ queryKey: ['admin', 'ai', 'reports'], queryFn: () => api<{ items: Report[] }>('/admin/ai/reports') });
  const drafts = useQuery({ queryKey: ['admin', 'ai', 'drafts'], queryFn: () => api<{ items: Draft[] }>('/admin/ai/drafts') });
  const feedback = useQuery({ queryKey: ['admin', 'ai', 'feedback'], queryFn: () => api<{ count: number; sentiments: Counts[]; topics: Counts[] }>('/admin/ai/feedback') });
  const stock = useQuery({ queryKey: ['admin', 'ai', 'inventory'], queryFn: () => api<{ items: { slug: string; name: LocalText; used: number; unit: string; onHand: number }[] }>('/admin/ai/inventory') });
  const [reportChoice, setReportChoice] = useState('');
  const report = reports.data?.items.find(item => item._id === reportChoice) ?? reports.data?.items[0];

  async function change(work: () => Promise<void>, area: string) {
    setPending(true);
    setError(undefined);
    try {
      await work();
      await cache.invalidateQueries({ queryKey: ['admin', 'ai', area] });
    } catch (error) { setError(error); }
    finally { setPending(false); }
  }

  function newDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void change(async () => {
      await send('/admin/ai/drafts', { type: valueOf(form, 'type'), tone: valueOf(form, 'tone'), brief: valueOf(form, 'brief'), language });
    }, 'drafts');
  }

  return <div className="grid gap-4">
    <RequestError error={error} />
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel title={t('ai.businessReport')}>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm font-bold">{t('admin.period')}<select className="field min-w-35" value={period} onChange={event => setPeriod(event.target.value)}>
            {['day', 'week', 'month'].map(value => <option key={value} value={value}>{t(`admin.${value}`)}</option>)}
          </select></label>
          <button className="button button-primary self-end" type="button" disabled={pending} onClick={() => void change(async () => {
            const response = await send<{ report: Report }>('/admin/ai/reports', { period, language });
            setReportChoice(response.report._id);
          }, 'reports')}>{t(pending ? 'common.loading' : 'ai.generateReport')}</button>
        </div>
        <RequestError error={reports.error} />
        {report && <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold">{t('ai.savedReport')}<select className="field" value={report._id} onChange={event => setReportChoice(event.target.value)}>
            {reports.data?.items.map(item => <option key={item._id} value={item._id}>{t(`admin.${item.period}`)} · {formatPrice(item.metrics.totals.revenue, language)}</option>)}
          </select></label>
          <dl className="grid gap-2 rounded-xl bg-moss p-3 text-sm">
            <div className="flex justify-between"><dt>{t('admin.revenue')}</dt><dd className="font-bold">{formatPrice(report.metrics.totals.revenue, language)}</dd></div>
            <div className="flex justify-between"><dt>{t('ai.paidOrders')}</dt><dd className="font-bold">{report.metrics.totals.paidOrders}</dd></div>
          </dl>
          <p className="text-xs font-bold text-muted">{t(`ai.source.${report.source}`)}</p>
          <p>{report.summary}</p>
          <ul className="grid gap-1 pl-5">{report.insights.map(item => <li key={item} className="list-disc">{item}</li>)}</ul>
        </div>}
      </Panel>

      <Panel title={t('ai.feedback')}>
        <RequestError error={feedback.error} />
        {feedback.data && <div className="grid gap-3">
          <p className="font-extrabold">{t('ai.reviewCount', { count: feedback.data.count })}</p>
          <ul className="flex flex-wrap gap-2">{feedback.data.sentiments.map(item => <li key={item._id} className="rounded-lg bg-moss p-2 text-sm font-bold">{t(`ai.sentiment.${item._id}`)} · {item.count}</li>)}</ul>
          <h3 className="font-bold">{t('ai.topics')}</h3>
          {!feedback.data.topics.length && <p className="text-sm text-muted">{t('admin.empty')}</p>}
          <ul className="grid gap-1">{feedback.data.topics.map(item => <li key={item._id} className="flex justify-between gap-2 border-b border-line py-1"><span>{item._id}</span><strong>{item.count}</strong></li>)}</ul>
        </div>}
      </Panel>

      <Panel title={t('ai.stockUse')}>
        <RequestError error={stock.error} />
        {stock.data?.items.length === 0 && <p>{t('admin.empty')}</p>}
        <ul className="grid gap-2">{stock.data?.items.map(item => <li key={item.slug} className="rounded-lg border border-line p-2">
          <strong>{item.name[language]}</strong><p className="text-sm text-muted">{t('ai.stockUsageLine', { used: item.used, onHand: item.onHand, unit: item.unit })}</p>
        </li>)}</ul>
      </Panel>

      <Panel title={t('ai.marketing')}>
        <form className="grid gap-3" onSubmit={newDraft}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">{t('ai.draftType')}<select className="field" name="type">
              {['social', 'description', 'promotion', 'seasonal'].map(type => <option key={type} value={type}>{t(`ai.type.${type}`)}</option>)}
            </select></label>
            <label className="grid gap-1 text-sm font-bold">{t('ai.tone')}<select className="field" name="tone">
              {['friendly', 'premium', 'playful'].map(tone => <option key={tone} value={tone}>{t(`ai.toneOptions.${tone}`)}</option>)}
            </select></label>
          </div>
          <label className="grid gap-1 text-sm font-bold">{t('ai.brief')}<textarea name="brief" maxLength={500} className="field" /></label>
          <button className="button button-primary w-fit" type="submit" disabled={pending}>{t('ai.generateDraft')}</button>
        </form>
        <RequestError error={drafts.error} />
        <ul className="mt-4 grid gap-3">{drafts.data?.items.map(draft => <li key={draft._id} className="rounded-xl border border-line p-3">
          <p className="text-sm font-bold">{t(`ai.draftStatus.${draft.status}`)} · {t(`ai.source.${draft.source}`)}</p>
          <p lang={draft.language} className="my-2 whitespace-pre-line">{draft.content}</p>
          {draft.status === 'draft' && <button type="button" className="button button-outline" disabled={pending} onClick={() => void change(async () => {
            await send(`/admin/ai/drafts/${draft._id}/approve`, undefined, 'PATCH');
          }, 'drafts')}>{t('ai.approveDraft')}</button>}
        </li>)}</ul>
      </Panel>
    </div>
  </div>;
}
