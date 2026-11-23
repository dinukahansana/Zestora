import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, type Order } from '../commerce/api';
import { formatPrice, type LocalText } from '../content/catalogue';
import { languageOf } from '../i18n';
import { Panel } from './Fields';

interface ReportRow { period: string; revenue: number; paidOrders: number }
interface Snapshot {
  metrics: { total: number; pending: number; completed: number; customers: number; revenue: number };
  recentOrders: Order[];
  popular: { _id: string; name: LocalText; units: number }[];
  lowStock: { slug: string; name: LocalText; onHand: number; unit: string }[];
  sales: ReportRow[];
}

export function Dashboard({ openOrders }: { openOrders: () => void }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const [period, setPeriod] = useState('day');
  const snapshot = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Snapshot>('/admin/dashboard') });
  const report = useQuery({
    queryKey: ['admin', 'reports', period],
    queryFn: () => api<{ items: ReportRow[] }>(`/admin/reports?period=${period}`),
    enabled: period !== 'day',
  });
  const rows = period === 'day' ? snapshot.data?.sales : report.data?.items;
  const largest = Math.max(1, ...(rows ?? []).map(row => row.revenue));

  if (!snapshot.data) return <>{snapshot.isError ? <RequestError error={snapshot.error} /> : <p role="status">{t('common.loading')}</p>}</>;

  return <div className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Object.entries(snapshot.data.metrics).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-line bg-paper p-4">
          <p className="text-sm font-extrabold text-muted">{t(`admin.${key}`)}</p>
          <strong className="mt-2 block text-xl">{key === 'revenue' ? formatPrice(value, language) : value}</strong>
        </div>
      ))}
    </div>
    <Panel title={t('admin.sales')}>
      <label className="mb-4 flex w-fit flex-wrap items-center gap-2 text-sm font-bold">{t('admin.period')}
        <select className="field w-40" value={period} onChange={event => setPeriod(event.target.value)}>
          {['day', 'week', 'month'].map(item => <option value={item} key={item}>{t(`admin.${item}`)}</option>)}
        </select>
      </label>
      <RequestError error={report.error} />
      {rows?.length === 0 && <p className="text-muted">{t('admin.noSales')}</p>}
      <ul className="grid gap-3">{rows?.map(row => (
        <li key={row.period} className="grid gap-1.5 text-sm">
          <div className="flex justify-between gap-3"><span>{row.period}</span><strong>{formatPrice(row.revenue, language)} · {row.paidOrders}</strong></div>
          <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-moss"><div className="h-full rounded-full bg-forest" style={{ width: `${row.revenue / largest * 100}%` }} /></div>
        </li>
      ))}</ul>
    </Panel>
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={t('admin.popular')}><ul className="grid gap-2">
        {snapshot.data.popular.map(item => <li key={item._id} className="flex justify-between gap-3 border-b border-line py-2"><span>{item.name[language]}</span><strong>{item.units}</strong></li>)}
      </ul>{!snapshot.data.popular.length && <p>{t('admin.empty')}</p>}</Panel>
      <Panel title={t('admin.lowStock')}><ul className="grid gap-2">
        {snapshot.data.lowStock.map(stock => <li key={stock.slug} className="flex justify-between gap-3 border-b border-line py-2"><span>{stock.name[language]}</span><strong>{stock.onHand} {stock.unit}</strong></li>)}
      </ul>{!snapshot.data.lowStock.length && <p>{t('admin.empty')}</p>}</Panel>
    </div>
    <Panel title={t('admin.recent')}>
      <ul className="grid gap-2">{snapshot.data.recentOrders.map(order => <li key={order.reference} className="flex flex-wrap justify-between gap-3 border-b border-line py-2"><span>{order.reference}</span><span>{t(`orderStatus.${order.orderStatus}`)}</span></li>)}</ul>
      {!snapshot.data.recentOrders.length && <p>{t('admin.empty')}</p>}
      <button className="button button-outline mt-4" type="button" onClick={openOrders}>{t('admin.orders')}</button>
    </Panel>
  </div>;
}
