import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, send } from '../commerce/api';
import { Panel } from './Fields';

interface EventRow {
  event: { eventId: string; eventType: string; resourceId: string; occurredAt: string };
  state: 'queued' | 'sending' | 'retry' | 'failed' | 'delivered';
  attempts: number;
  nextAttempt: string;
  lastError?: string;
  noticeStatus?: 'queued' | 'sending' | 'sent' | 'failed' | 'suppressed';
}

export function AutomationAdmin() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [pending, setPending] = useState('');
  const [error, setError] = useState<unknown>();
  const [state, setState] = useState('');
  const key = ['admin', 'automation'];
  const query = useQuery({ queryKey: [...key, state], queryFn: () => api<{ enabled: boolean; scheduleEnabled: boolean; items: EventRow[] }>('/admin/automation' + (state ? '?state=' + state : '')), refetchInterval: 12000 });

  async function retry(id: string) {
    setPending(id);
    setError(undefined);
    try {
      await send(`/admin/automation/${id}/retry`);
      await cache.invalidateQueries({ queryKey: key });
    } catch (error) { setError(error); }
    finally { setPending(''); }
  }

  return <Panel title={t('admin.automation')}>
    {query.isPending && <p role="status">{t('common.loading')}</p>}
    {query.data && <p className="mb-4 text-sm text-muted">{t(query.data.enabled ? 'automation.enabled' : 'automation.disabled')}</p>}
    {query.data && <p className="mb-4 text-sm text-muted">{t(query.data.scheduleEnabled ? 'automation.scheduleEnabled' : 'automation.scheduleDisabled')}</p>}
    <label className="mb-4 grid max-w-xs gap-1 text-sm font-bold">{t('automation.filter')}
      <select className="field" value={state} onChange={event => setState(event.target.value)}>
        <option value="">{t('automation.allStates')}</option>
        {['queued', 'sending', 'retry', 'failed', 'delivered'].map(value => <option value={value} key={value}>{t(`automation.state.${value}`)}</option>)}
      </select>
    </label>
    <RequestError error={error ?? query.error} />
    <ul className="grid gap-2">
      {query.data?.items.map(({ event, state, attempts, lastError, nextAttempt, noticeStatus }) => (
        <li key={event.eventId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
          <div className="min-w-0">
            <strong>{t(`automation.event.${event.eventType.replace('.', '_')}`, { defaultValue: event.eventType })}</strong>
            <span className="block break-all text-muted">{event.resourceId} · {new Date(event.occurredAt).toLocaleString()}</span>
            {noticeStatus && <span className="block text-xs text-muted">{t('automation.mail', { state: t(`automation.notice.${noticeStatus}`) })}</span>}
            {state === 'retry' && <span className="block text-xs text-muted">{t('automation.nextAttempt', { time: new Date(nextAttempt).toLocaleString() })}</span>}
            {lastError && <span className="block text-xs text-muted">{lastError}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-moss px-2.5 py-1 font-bold">{t(`automation.state.${state}`)} · {attempts}</span>
            {state === 'failed' && <button type="button" className="button button-outline" disabled={!!pending} onClick={() => void retry(event.eventId)}>{t('common.retry')}</button>}
          </div>
        </li>
      ))}
    </ul>
    {query.data?.items.length === 0 && <p>{t('admin.empty')}</p>}
  </Panel>;
}
