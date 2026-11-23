import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeading } from '../components/Storefront';
import { api, RequestError, send, useAccount, type Account, type Address, type Order } from '../commerce/api';
import { useCart } from '../commerce/cart';
import { formatPrice } from '../content/catalogue';
import { languageOf } from '../i18n';

function SignInForm() {
  const { t } = useTranslation();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const cache = useQueryClient();
  const [search] = useSearchParams();
  const go = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError(undefined);
    try {
      const { user } = await send<{ user: Account }>(register ? '/auth/register' : '/auth/login', data);
      cache.setQueryData(['account'], user);
      if (search.get('next') === 'checkout') void go('/checkout');
      if (search.get('next') === 'admin' && user.role === 'admin') void go('/admin');
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid max-w-md gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-7" key={String(register)} onSubmit={event => void submit(event)}>
      <h2 className="font-display text-3xl">{t(register ? 'account.create' : 'account.signIn')}</h2>
      {register && <label className="grid gap-1 text-sm font-bold">{t('contact.name')}<input className="field" name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>}
      <label className="grid gap-1 text-sm font-bold">{t('contact.email')}<input className="field" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label className="grid gap-1 text-sm font-bold">{t('account.password')}<input className="field" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={128} required /></label>
      <RequestError error={error} />
      <button className="button button-primary" type="submit" disabled={pending}>{t(pending ? 'common.loading' : register ? 'account.create' : 'account.signIn')}</button>
      <button type="button" className="text-left text-sm font-extrabold underline" onClick={() => { setRegister(!register); setError(undefined); }}>{t(register ? 'account.useLogin' : 'account.create')}</button>
      {!register && <Link to="/forgot-password" className="text-sm font-extrabold underline">{t('account.forgot')}</Link>}
    </form>
  );
}

function Profile({ account }: { account: Account }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const cache = useQueryClient();
  const go = useNavigate();
  const addItem = useCart(state => state.add);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Partial<Address>>({});
  const profileKey = ['profile', account.id];
  const profile = useQuery({ queryKey: profileKey, queryFn: () => api<{ addresses: Address[] }>('/account') });
  const history = useQuery({ queryKey: ['orders', account.id], queryFn: () => api<{ orders: Order[] }>('/orders/mine') });

  async function perform(action: () => Promise<void>) {
    setPending(true);
    setError(undefined);
    try { await action(); } catch (error) { setError(error); }
    finally { setPending(false); }
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('name');
    void perform(async () => {
      const { user } = await send<{ user: Account }>('/account', { name }, 'PATCH');
      cache.setQueryData(['account'], user);
    });
  }

  function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    void perform(async () => {
      const path = draft._id ? `/account/addresses/${draft._id}` : '/account/addresses';
      const result = await send<{ addresses: Address[] }>(path, body, draft._id ? 'PATCH' : 'POST');
      cache.setQueryData(profileKey, result);
      setDraft({});
      form.reset();
    });
  }

  async function logout() {
    await send('/auth/logout');
    cache.setQueryData(['account'], null);
    cache.removeQueries({ queryKey: profileKey });
    cache.removeQueries({ queryKey: ['orders', account.id] });
  }

  return (
    <div className="grid gap-5">
      <RequestError error={error} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-7">
          <h2 className="font-display text-3xl">{t('account.profile')}</h2>
          <p className="break-all text-sm text-muted">{account.email}</p>
          <form className="grid gap-3" onSubmit={saveName}>
            <label className="grid gap-1 text-sm font-bold">{t('contact.name')}<input className="field" name="name" defaultValue={account.name} minLength={2} maxLength={100} required /></label>
            <button type="submit" className="button button-primary w-fit" disabled={pending}>{t('account.save')}</button>
          </form>
          {account.role === 'admin' && <Link className="button button-primary w-fit" to="/admin">{t('admin.title')}</Link>}
          <button type="button" className="button button-outline w-fit" disabled={pending} onClick={() => void perform(logout)}>{t('account.signOut')}</button>
        </section>
        <section className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-7">
          <h2 className="font-display text-3xl">{t('account.savedAddresses')}</h2>
          <RequestError error={profile.error} />
          <ul className="grid gap-2">{profile.data?.addresses.map(address => (
            <li key={address._id} className="rounded-xl border border-line p-3">
              <p className="font-bold">{address.label}</p>
              <p className="text-sm text-muted">{address.address}</p>
              <div className="mt-2 flex gap-4 text-sm font-bold">
                <button type="button" className="underline" onClick={() => setDraft(address)}>{t('account.edit')}</button>
                <button type="button" className="underline" disabled={pending} onClick={() => void perform(async () => {
                  await send(`/account/addresses/${address._id}`, undefined, 'DELETE');
                  if (draft._id === address._id) setDraft({});
                  await cache.invalidateQueries({ queryKey: profileKey });
                })}>{t('commerce.remove')}</button>
              </div>
            </li>
          ))}</ul>
          <form key={draft._id ?? 'new'} className="grid gap-3" onSubmit={saveAddress}>
            <label className="grid gap-1 text-sm font-bold">{t('account.label')}<input className="field" name="label" defaultValue={draft.label} maxLength={60} required /></label>
            <label className="grid gap-1 text-sm font-bold">{t('commerce.address')}<textarea className="field" name="address" defaultValue={draft.address} minLength={8} maxLength={350} required /></label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="button button-primary" disabled={pending}>{t('account.saveAddress')}</button>
              {draft._id && <button type="button" className="button button-outline" onClick={() => setDraft({})}>{t('account.cancel')}</button>}
            </div>
          </form>
        </section>
      </div>

      <section className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-7">
        <h2 className="font-display text-3xl">{t('account.history')}</h2>
        <RequestError error={history.error} />
        {history.isPending && <p role="status">{t('common.loading')}</p>}
        {history.data?.orders.length === 0 && <p>{t('account.noOrders')}</p>}
        <ul className="grid gap-3">{history.data?.orders.map(order => (
          <li key={order.reference} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
            <span><Link className="font-extrabold underline" to={`/track?reference=${order.reference}`}>{order.reference}</Link><span className="mt-1 block text-sm text-muted">{t(`orderStatus.${order.orderStatus}`)} · {formatPrice(order.totals.total, language)}</span></span>
            <button type="button" className="button button-outline" onClick={() => {
              order.items.forEach(item => addItem({ productSlug: item.productSlug, sizeId: item.size.id, addOnIds: item.addOns.map(option => option.id), quantity: item.quantity }));
              void go('/cart');
            }}>{t('account.reorder')}</button>
          </li>
        ))}</ul>
      </section>
    </div>
  );
}

export function AccountPage() {
  const { t } = useTranslation();
  const account = useAccount();
  return (
    <>
      <PageHeading title={t('account.title')} />
      <div className="container-wide py-8">
        {account.isPending ? <p role="status">{t('common.loading')}</p> : account.isError ? <RequestError error={account.error} />
          : account.data ? <Profile key={account.data.id} account={account.data} /> : <SignInForm />}
      </div>
    </>
  );
}
