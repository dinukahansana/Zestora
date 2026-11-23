import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { api, RequestError, send, useAccount, type Order, type PaymentEnvironment } from '../commerce/api';
import { PageHeading } from '../components/Storefront';

type GatewayStart = { environment: 'simulator' } | { environment: 'sandbox' | 'live'; action: string; fields: Record<string, string> };
interface Result { reference: string; status: string; environment?: PaymentEnvironment; amount: number }
const storageKey = (reference: string) => `zestora.payhere.${reference}`;

export function PaymentAction({ order, guestKey, onStatus }: { order: Order; guestKey?: string; onStatus: (status: string) => void }) {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<Result>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();

  const access = { reference: order.reference, key: guestKey };

  async function act(action: () => Promise<void>) {
    setPending(true);
    setError(undefined);
    try { await action(); } catch (error) { setError(error); }
    finally { setPending(false); }
  }

  async function start() {
    const gateway = await send<GatewayStart>('/payments/payhere/start', access);
    if (gateway.environment === 'simulator') {
      setStarted(true);
      return;
    }
    if (gateway.action !== 'https://sandbox.payhere.lk/pay/checkout' && gateway.action !== 'https://www.payhere.lk/pay/checkout') {
      throw new Error('Payment gateway unavailable.');
    }
    if (guestKey) {
      try { sessionStorage.setItem(storageKey(order.reference), guestKey); } catch { /* The customer can still use their saved key. */ }
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = gateway.action;
    form.hidden = true;
    for (const [key, value] of Object.entries(gateway.fields)) {
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = key;
      field.value = value;
      form.appendChild(field);
    }
    document.body.appendChild(form);
    form.submit();
  }

  async function simulate(outcome: 'paid' | 'failed') {
    const updated = await send<Result>('/payments/simulate', { ...access, outcome });
    setResult(updated);
    onStatus(updated.status);
  }

  if (order.paymentMethod !== 'payhere' || !['pending', 'failed'].includes(order.paymentStatus)) return null;

  return <section className="grid gap-3 rounded-xl border border-line bg-paper p-4">
    {order.paymentEnvironment !== 'live' && <p className="font-bold">{t(`payment.${order.paymentEnvironment ?? 'sandbox'}`)}</p>}
    <RequestError error={error} />
    {!started
      ? <button type="button" className="button button-primary w-fit" disabled={pending} onClick={() => void act(start)}>{t('payment.pay')}</button>
      : <>
        {result && <p role="status">{t('payment.simulatedStatus', { status: t(`paymentStatus.${result.status}`) })}</p>}
        {result?.status !== 'paid' && <div className="flex flex-wrap gap-2">
          <button type="button" className="button button-primary" disabled={pending} onClick={() => void act(() => simulate('paid'))}>{t('payment.simulatePaid')}</button>
          <button type="button" className="button button-outline" disabled={pending} onClick={() => void act(() => simulate('failed'))}>{t('payment.simulateFailed')}</button>
        </div>}
      </>}
  </section>;
}

function savedKey(reference: string) {
  try { return sessionStorage.getItem(storageKey(reference)) ?? ''; } catch { return ''; }
}

export default function PaymentResultPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? '';
  const account = useAccount();
  const key = savedKey(reference);
  const [openedAt] = useState(Date.now);
  const status = useQuery({
    queryKey: ['payment-result', reference, key, account.data?.id],
    enabled: !!reference && (!!key || !!account.data),
    queryFn: () => api<Result>('/payments/status', { method: 'POST', body: JSON.stringify({ reference, key: key || undefined }) }),
    refetchInterval: query => query.state.data?.status === 'pending' && Date.now() - openedAt < 25000 ? 2500 : false,
  });

  return <>
    <PageHeading title={t('payment.result')} />
    <div className="container-wide grid max-w-3xl gap-4 py-8">
      {params.has('cancelled') && <p>{t('payment.cancelledReturn')}</p>}
      <p className="text-muted">{t('payment.verifiedByServer')}</p>
      <RequestError error={status.error} />
      {status.data && <div className="rounded-xl border border-line bg-paper p-4">
        <p className="font-bold">{status.data.reference}</p>
        <p>{t(`paymentStatus.${status.data.status}`)}</p>
        {status.data.environment && status.data.environment !== 'live' && <p>{t(`payment.${status.data.environment}`)}</p>}
        <button type="button" className="button button-outline mt-3" onClick={() => void status.refetch()}>{t('payment.refresh')}</button>
      </div>}
      <Link className="button button-primary w-fit" to={reference ? `/track?reference=${encodeURIComponent(reference)}` : '/track'}>{t('commerce.track')}</Link>
    </div>
  </>;
}
