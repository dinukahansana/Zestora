import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, send, type Order } from '../commerce/api';
import { OrderDetails } from '../commerce/Summary';
import { formatPrice } from '../content/catalogue';
import { languageOf } from '../i18n';
import { Pager, Panel } from './Fields';

const statuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'];
interface Page<T> { items: T[]; offset: number; total: number }

function nextStates(order: Order) {
  const next = ({
    pending: 'confirmed', confirmed: 'preparing',
    preparing: order.fulfillment.type === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery',
    ready_for_pickup: 'completed', out_for_delivery: 'completed',
  } as Record<string, string>)[order.orderStatus];
  const cancel = !['completed', 'cancelled'].includes(order.orderStatus) && order.paymentStatus !== 'paid';
  return [next, cancel && 'cancelled'].filter(Boolean) as string[];
}

export function OrdersAdmin() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const params = new URLSearchParams({ offset: String(offset), ...(search.trim() && { q: search.trim() }), ...(status && { status }) });
  const list = useQuery({ queryKey: ['admin', 'orders', params.toString()], queryFn: ({ signal }) => api<Page<Order>>(`/admin/orders?${params}`, { signal }) });
  const details = useQuery({ queryKey: ['admin', 'order', selected], enabled: !!selected, queryFn: () => api<{ order: Order }>(`/admin/orders/${selected}`) });
  const order = details.data?.order;

  async function update(path: string, values?: unknown) {
    setPending(true);
    setError(undefined);
    try {
      const { order } = await send<{ order: Order }>(`/admin/orders/${selected}/${path}`, values, 'PATCH');
      cache.setQueryData(['admin', 'order', selected], { order });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        cache.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        cache.invalidateQueries({ queryKey: ['admin', 'reports'] }),
      ]);
    } catch (error) { setError(error); }
    finally { setPending(false); }
  }

  return <div className="grid items-start gap-4 xl:grid-cols-[.85fr_1.15fr]">
    <Panel title={t('admin.orders')}>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">{t('admin.searchOrders')}<input className="field" type="search" maxLength={254} value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} /></label>
        <label className="grid gap-1 text-sm font-bold">{t('commerce.orderStatus')}<select className="field" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
          <option value="">{t('admin.allStatuses')}</option>
          {statuses.map(item => <option key={item} value={item}>{t(`orderStatus.${item}`)}</option>)}
        </select></label>
      </div>
      <RequestError error={list.error} />
      {list.isPending && <p role="status">{t('common.loading')}</p>}
      {list.data?.items.length === 0 && <p>{t('admin.empty')}</p>}
      <ul className="grid gap-2">{list.data?.items.map(item => <li key={item.reference}>
        <button type="button" className={`w-full rounded-xl border border-line p-3 text-left text-sm ${item.reference === selected ? 'bg-moss' : 'hover:bg-moss/50'}`} onClick={() => { setSelected(item.reference); setError(undefined); }}>
          <strong className="break-all">{item.reference}</strong>
          <span className="mt-1 block">{item.customer.name} · {t(`orderStatus.${item.orderStatus}`)} · {formatPrice(item.totals.total, language)}</span>
        </button>
      </li>)}</ul>
      {list.data && <Pager offset={offset} total={list.data.total} onChange={setOffset} />}
    </Panel>
    <Panel title={t('admin.orderDetails')}>
      {!selected && <p className="text-muted">{t('admin.chooseOrder')}</p>}
      <RequestError error={details.error ?? error} />
      {order && <>
        <div id="admin-print">
          <div className="mb-3 grid gap-1 text-sm">
            <strong>{order.customer.name}</strong><span className="break-all">{order.customer.email}</span><span>{order.customer.phone}</span>
            {order.fulfillment.instructions && <p className="mt-2"><strong>{t('commerce.instructions')} </strong>{order.fulfillment.instructions}</p>}
            {order.notes && <p><strong>{t('commerce.notes')} </strong>{order.notes}</p>}
          </div>
          <OrderDetails order={order} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {nextStates(order).map(value => <button key={value} type="button" className="button button-outline" disabled={pending} onClick={() => void update('status', { status: value })}>{t(`orderStatus.${value}`)}</button>)}
          {order.paymentStatus === 'pending' && order.paymentMethod !== 'payhere' && order.orderStatus !== 'cancelled' &&
            <button type="button" className="button button-primary" disabled={pending} onClick={() => void update('cash-payment')}>{t('admin.cashPaid')}</button>}
          <button type="button" className="button button-outline" onClick={() => window.print()}>{t('admin.print')}</button>
        </div>
      </>}
    </Panel>
  </div>;
}

interface Customer { _id: string; name: string; email: string }

export function CustomersAdmin() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Customer>();
  const list = useQuery({
    queryKey: ['admin', 'customers', search, offset],
    queryFn: ({ signal }) => api<Page<Customer>>(`/admin/customers?${new URLSearchParams({ q: search, offset: String(offset) })}`, { signal }),
  });
  const history = useQuery({
    queryKey: ['admin', 'history', selected?._id],
    enabled: !!selected,
    queryFn: () => api<{ items: Order[] }>(`/admin/customers/${selected?._id}/orders`),
  });
  return <div className="grid items-start gap-4 lg:grid-cols-2">
    <Panel title={t('admin.customers')}>
      <label className="mb-4 grid gap-1 text-sm font-bold">{t('admin.searchCustomers')}<input className="field" type="search" value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} /></label>
      <RequestError error={list.error} />
      {list.data?.items.length === 0 && <p>{t('admin.empty')}</p>}
      <ul className="grid gap-2">{list.data?.items.map(item => <li key={item._id}>
        <button type="button" className="w-full rounded-xl border border-line p-3 text-left hover:bg-moss/50" onClick={() => setSelected(item)}><strong>{item.name}</strong><span className="block break-all text-sm text-muted">{item.email}</span></button>
      </li>)}</ul>
      {list.data && <Pager offset={offset} total={list.data.total} onChange={setOffset} />}
    </Panel>
    <Panel title={t('account.history')}>
      {selected ? <p className="mb-3 font-bold">{selected.name}</p> : <p>{t('admin.chooseCustomer')}</p>}
      <RequestError error={history.error} />
      {history.data?.items.length === 0 && <p>{t('admin.empty')}</p>}
      <ul className="grid gap-2">{history.data?.items.map(order => <li key={order.reference} className="border-b border-line py-2 text-sm">
        <strong className="break-all">{order.reference}</strong><span className="block text-muted">{t(`orderStatus.${order.orderStatus}`)} · {formatPrice(order.totals.total, language)}</span>
      </li>)}</ul>
    </Panel>
  </div>;
}
