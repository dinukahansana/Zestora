import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { PageHeading } from '../components/Storefront';
import { api, RequestError, send, useAccount, type Order } from '../commerce/api';
import { PaymentAction } from './Payment';
import { OrderDetails } from '../commerce/Summary';
import { languageOf } from '../i18n';

export function ConfirmationPage() {
  const { t } = useTranslation();
  const state = useLocation().state as { order?: Order; guestKey?: string } | null;
  const [updated, setUpdated] = useState<{ reference: string; status: string }>();
  const order = state?.order && updated?.reference === state.order.reference ? { ...state.order, paymentStatus: updated.status } : state?.order;
  return (
    <>
      <PageHeading title={t('commerce.confirmation')} />
      <div className="container-wide grid max-w-3xl gap-4 py-8">
        {order && <><OrderDetails order={order} /><PaymentAction order={order} guestKey={state?.guestKey} onStatus={status => setUpdated({ reference: order.reference, status })} /></>}
        {state?.guestKey && <div className="rounded-xl bg-moss p-4">
          <label className="grid gap-2 text-sm font-extrabold">{t('commerce.trackingKey')}
            <input className="field font-mono" readOnly value={state.guestKey} onFocus={event => event.currentTarget.select()} />
          </label>
          <p className="mt-2 text-sm text-muted">{t('commerce.keepKey')}</p>
        </div>}
        <Link className="button button-primary w-fit" to={state?.order ? `/track?reference=${state.order.reference}` : '/track'}>{t('commerce.track')}</Link>
      </div>
    </>
  );
}

export function TrackingPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<Order>();
  const [trackingKey, setTrackingKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const reference = String(values.get('reference') ?? '').trim().toUpperCase();
    const key = String(values.get('key') ?? '').trim();
    setPending(true);
    setOrder(undefined);
    setError(undefined);
    try {
      const result = key
        ? await send<{ order: Order }>('/orders/track', { reference, key })
        : await api<{ order: Order }>(`/orders/mine/${encodeURIComponent(reference)}`);
      setTrackingKey(key);
      setOrder(result.order);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading title={t('commerce.track')} />
      <div className="container-wide grid max-w-3xl gap-4 py-8">
        <form className="grid gap-3 rounded-2xl border border-line bg-paper p-5" onSubmit={event => void submit(event)}>
          <label className="grid gap-1 text-sm font-bold">{t('commerce.reference')}<input className="field" name="reference" defaultValue={params.get('reference') ?? ''} maxLength={22} required /></label>
          <label className="grid gap-1 text-sm font-bold">{t('commerce.trackingKey')}<input className="field" name="key" maxLength={43} required={!account.data} /></label>
          {account.data && <p className="text-sm text-muted">{t('commerce.signedTracking')}</p>}
          <button className="button button-primary w-fit" type="submit" disabled={pending}>{t(pending ? 'common.loading' : 'commerce.findOrder')}</button>
        </form>
        <RequestError error={error} />
        {order && <><OrderDetails order={order} /><PaymentAction order={order} guestKey={trackingKey || undefined} onStatus={status => setOrder({ ...order, paymentStatus: status })} /></>}
      </div>
    </>
  );
}

export function PasswordPage({ reset = false }: { reset?: boolean }) {
  const { t, i18n } = useTranslation();
  const { hash } = useLocation();
  const key = new URLSearchParams(hash.slice(1)).get('key');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      if (reset) await send('/auth/reset-password', { key, password: values.get('password') });
      else await send('/auth/forgot-password', { email: values.get('email'), language: languageOf(i18n.resolvedLanguage) });
      setSent(true);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading title={t(reset ? 'account.reset' : 'account.forgot')} />
      <div className="container-wide py-8">
        {sent ? <p role="status">{t(reset ? 'account.resetSuccess' : 'account.resetSent')}</p> : reset && !key ? <p role="alert">{t('errors.RESET_INVALID')}</p> : (
          <form className="grid max-w-md gap-4 rounded-2xl border border-line bg-paper p-5" onSubmit={event => void submit(event)}>
            {reset
              ? <label className="grid gap-1 text-sm font-bold">{t('account.newPassword')}<input className="field" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
              : <label className="grid gap-1 text-sm font-bold">{t('contact.email')}<input className="field" name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
            <RequestError error={error} />
            <button className="button button-primary w-fit" type="submit" disabled={pending}>{t(pending ? 'common.loading' : reset ? 'account.reset' : 'account.requestReset')}</button>
          </form>
        )}
        <Link className="button button-outline mt-4" to="/account">{t('account.signIn')}</Link>
      </div>
    </>
  );
}
