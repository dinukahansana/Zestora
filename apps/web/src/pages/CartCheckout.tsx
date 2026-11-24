import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { PageHeading } from '../components/Storefront';
import { api, ApiError, RequestError, send, useAccount, type Address, type Order, type Quote, type Shop } from '../commerce/api';
import { lineKey, quantities, useCart } from '../commerce/cart';
import { TotalsTable } from '../commerce/Summary';
import { formatPrice } from '../content/catalogue';
import { useCatalogue } from '../content/useCatalogue';
import { languageOf } from '../i18n';

export function CartPage() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const { items, change, remove } = useCart();
  const catalogue = useCatalogue();

  const lines = items.map(line => {
    const product = catalogue.data?.products.find(item => line.productSlug === item.slug);
    const size = product?.sizes.find(item => line.sizeId === item.id);
    const addOns = product?.addOns.filter(item => line.addOnIds.includes(item.id)) ?? [];
    const price = size && product?.available && addOns.length === line.addOnIds.length
      ? (size.price + addOns.reduce((amount, item) => amount + item.price, 0)) * line.quantity
      : undefined;
    return { line, product, size, addOns, price };
  });
  const canCheckout = lines.length > 0 && lines.every(line => line.price !== undefined);

  return (
    <>
      <PageHeading title={t('commerce.cart')} />
      <div className="container-wide py-8">
        {!items.length && <div className="rounded-2xl border border-line bg-paper p-6">
          <p>{t('commerce.empty')}</p><Link className="button button-primary mt-4" to="/menu">{t('common.backMenu')}</Link>
        </div>}
        {!!items.length && <div className="grid items-start gap-5 lg:grid-cols-[1fr_18rem]">
          <ul className="grid gap-3">
            {lines.map(({ line, product, size, addOns, price }) => (
              <li key={lineKey(line)} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper p-4">
                {product && <img src={product.image} alt="" className="size-16 rounded-xl object-cover" />}
                <div className="min-w-36 flex-1">
                  {product
                    ? <Link className="font-extrabold hover:underline" to={`/menu/${product.slug}`}>{product.name[language]}</Link>
                    : <p className="font-extrabold">{line.productSlug}</p>}
                  <p className="mt-1 text-sm text-muted">{size?.name[language]}{addOns.map(item => ' + ' + item.name[language])}</p>
                  {price === undefined && !catalogue.isPending && <p className="mt-1 text-sm text-[#853c2d]">{t('errors.ITEM_UNAVAILABLE')}</p>}
                </div>
                <select className="field w-19" aria-label={`${t('product.quantity')}: ${product?.name[language] ?? line.productSlug}`} value={line.quantity} onChange={event => change(lineKey(line), Number(event.target.value))}>
                  {quantities.map(quantity => <option key={quantity} value={quantity}>{quantity}</option>)}
                </select>
                <span className="text-sm font-extrabold">{price === undefined ? '' : formatPrice(price, language)}</span>
                <button type="button" className="grid size-10 place-items-center rounded-full bg-blush" aria-label={`${t('commerce.remove')}: ${product?.name[language] ?? line.productSlug}`} onClick={() => remove(lineKey(line))}><Trash2 size={17} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <aside className="rounded-2xl border border-line bg-moss/40 p-5">
            <p className="font-bold">{t('commerce.estimatedSubtotal')}</p>
            <p className="mt-1 text-xl font-extrabold">{formatPrice(lines.reduce((amount, line) => amount + (line.price ?? 0), 0), language)}</p>
            <p className="mt-2 text-sm text-muted">{t('commerce.checkoutHint')}</p>
            {canCheckout && <Link className="button button-primary mt-4" to="/checkout">{t('commerce.checkout')}</Link>}
          </aside>
        </div>}
        <RequestError error={catalogue.error} />
      </div>
    </>
  );
}

const attemptSchema = z.object({ fingerprint: z.string(), checkoutKey: z.uuid(), guestKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const attemptStorage = 'zestora.checkoutAttempt';

async function checkoutAttempt(fingerprint: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const fingerprintHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const stored = attemptSchema.safeParse(JSON.parse(sessionStorage.getItem(attemptStorage) ?? 'null'));
    if (stored.success && stored.data.fingerprint === fingerprintHash) return stored.data;
  } catch {
    // When storage is blocked, the caller still retains the current attempt.
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const guestKey = btoa(String.fromCharCode(...rawKey)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const attempt = { fingerprint: fingerprintHash, checkoutKey: crypto.randomUUID(), guestKey };
  try { sessionStorage.setItem(attemptStorage, JSON.stringify(attempt)); } catch { /* Session-local fallback. */ }
  return attempt;
}

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const go = useNavigate();
  const account = useAccount();
  const { items, removePurchased } = useCart();
  const shop = useQuery({ queryKey: ['checkout-settings'], queryFn: () => api<Shop>('/shop/checkout') });
  const profile = useQuery({
    queryKey: ['profile', account.data?.id],
    enabled: !!account.data,
    queryFn: () => api<{ addresses: Address[] }>('/account'),
  });
  const [chosenFulfillment, setChosenFulfillment] = useState<'pickup' | 'delivery'>();
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<'cash' | 'payhere'>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState<{ key: string; data: Quote }>();
  const [attempt, setAttempt] = useState<{ request: string; data: z.infer<typeof attemptSchema> }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();

  const type = chosenFulfillment ?? (shop.data?.pickupEnabled ? 'pickup' : 'delivery');
  const fulfillment = type === 'delivery' ? { type, zoneId } : { type };
  const coupon = couponCode.trim().toUpperCase() || undefined;
  const quoteInput = { items, coupon, fulfillment };
  const quoteKey = JSON.stringify(quoteInput);
  const currentQuote = quote?.key === quoteKey ? quote.data : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim();
    setError(undefined);
    setPending(true);
    try {
      if (!currentQuote) {
        setQuote({ key: quoteKey, data: await send<Quote>('/orders/quote', quoteInput) });
        return;
      }
      const preferredAt = value('preferredAt') ? new Date(value('preferredAt')).toISOString() : undefined;
      const body = {
        items,
        coupon,
        customer: { name: value('name'), email: value('email'), phone: value('phone') },
        fulfillment: type === 'delivery' ? { type, zoneId, address, instructions: value('instructions'), preferredAt } : { type, preferredAt },
        notes: value('notes'),
        expectedTotal: currentQuote.totals.total,
        ...(values.has('feedbackEmail') && { feedbackEmail: true }),
        payment,
        billing: payment === 'payhere' ? { address: value('billingAddress'), city: value('billingCity') } : undefined,
        language,
      };
      const request = JSON.stringify([account.data?.id, body]);
      const current = attempt?.request === request ? attempt.data : await checkoutAttempt(request);
      setAttempt({ request, data: current });
      const guestKey = account.data ? undefined : current.guestKey;
      const { order } = await send<{ order: Order }>('/orders', { ...body, checkoutKey: current.checkoutKey, guestKey });
      removePurchased(items);
      try { sessionStorage.removeItem(attemptStorage); } catch { /* Checkout is complete. */ }
      void go('/order-confirmation', { replace: true, state: { order, guestKey } });
    } catch (error) {
      setError(error);
      if (error instanceof ApiError && error.code === 'TOTAL_CHANGED') setQuote(undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading title={t('commerce.checkout')} />
      <div className="container-wide py-8">
        {!items.length ? <Link className="button button-primary" to="/cart">{t('commerce.cart')}</Link>
          : !shop.data || account.isPending ? (
            shop.isError ? <RequestError error={shop.error} /> : <p role="status" className="text-muted">{t('common.loading')}</p>
          ) : <>
            <div className="mb-4">
              {!account.data && <p className="text-sm text-muted">{t('commerce.guestCheckout')} <Link className="font-bold underline" to="/account?next=checkout">{t('account.signIn')}</Link></p>}
            </div>
            <form onSubmit={event => void submit(event)} className="grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <div className="grid gap-5 rounded-2xl border border-line bg-paper p-5 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-bold">{t('contact.name')}<input name="name" autoComplete="name" className="field" minLength={2} maxLength={100} required defaultValue={account.data?.name} /></label>
                  <label className="grid gap-1 text-sm font-bold">{t('contact.email')}<input name="email" type="email" autoComplete="email" className="field" maxLength={254} required defaultValue={account.data?.email} /></label>
                  <label className="grid gap-1 text-sm font-bold">{t('contact.phone')}<input name="phone" type="tel" autoComplete="tel" className="field" minLength={7} maxLength={25} required /></label>
                  <label className="grid gap-1 text-sm font-bold">{t('commerce.fulfillment')}
                    <select className="field" value={type} onChange={event => setChosenFulfillment(event.target.value === 'delivery' ? 'delivery' : 'pickup')}>
                      {shop.data.pickupEnabled && <option value="pickup">{t('commerce.pickup')}</option>}
                      {shop.data.deliveryEnabled && <option value="delivery">{t('commerce.delivery')}</option>}
                    </select>
                  </label>
                </div>
                {type === 'delivery' && <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-bold">{t('commerce.zone')}<select className="field" required value={zoneId} onChange={event => setZoneId(event.target.value)}>
                    <option value="">{t('commerce.selectZone')}</option>
                    {shop.data.deliveryZones.map(zone => <option key={zone.id} value={zone.id}>{zone.name[language]} · {formatPrice(zone.fee, language)}</option>)}
                  </select></label>
                  {!!profile.data?.addresses.length && <label className="grid gap-1 text-sm font-bold">{t('account.savedAddresses')}
                    <select className="field" defaultValue="" onChange={event => setAddress(profile.data?.addresses.find(item => item._id === event.target.value)?.address ?? '')}>
                      <option value="">{t('commerce.newAddress')}</option>
                      {profile.data.addresses.map(item => <option key={item._id} value={item._id}>{item.label}</option>)}
                    </select>
                  </label>}
                  <label className="grid gap-1 text-sm font-bold">{t('commerce.address')}<textarea className="field" autoComplete="street-address" minLength={8} maxLength={350} required value={address} onChange={event => setAddress(event.target.value)} /></label>
                  <label className="grid gap-1 text-sm font-bold">{t('commerce.instructions')}<textarea name="instructions" className="field" maxLength={500} /></label>
                </div>}
                <label className="grid gap-1 text-sm font-bold">{t('commerce.preferredAt')}<input name="preferredAt" type="datetime-local" className="field" /></label>
                <label className="grid gap-1 text-sm font-bold">{t('commerce.notes')}<textarea name="notes" className="field" maxLength={500} /></label>
                <label className="flex items-start gap-2 text-sm"><input className="mt-1 accent-forest" type="checkbox" name="feedbackEmail" />{t('commerce.feedbackEmail')}</label>
              </div>

              <section className="grid gap-4 rounded-2xl border border-line bg-moss/40 p-5 sm:p-7">
                <h2 className="font-display text-3xl">{t('commerce.summary')}</h2>
                <label className="grid gap-1 text-sm font-bold">{t('commerce.coupon')}<input className="field" maxLength={32} value={couponCode} onChange={event => setCouponCode(event.target.value)} /></label>
                {shop.data.paymentEnvironment ? <label className="grid gap-1 text-sm font-bold">{t('commerce.method')}
                  <select className="field" value={payment} onChange={event => setPayment(event.target.value === 'payhere' ? 'payhere' : 'cash')}>
                    <option value="cash">{t(type === 'delivery' ? 'paymentMethod.cash_delivery' : 'paymentMethod.cash_pickup')}</option>
                    <option value="payhere">{t('paymentMethod.payhere')}</option>
                  </select>
                </label> : <p className="text-sm font-bold">{t(type === 'delivery' ? 'paymentMethod.cash_delivery' : 'paymentMethod.cash_pickup')}</p>}
                {payment === 'payhere' && <div className="grid gap-2">
                  {shop.data.paymentEnvironment !== 'live' && <p className="text-sm font-bold">{t(`payment.${shop.data.paymentEnvironment}`)}</p>}
                  <label className="grid gap-1 text-sm font-bold">{t('payment.billingAddress')}<input className="field" name="billingAddress" minLength={8} maxLength={350} required /></label>
                  <label className="grid gap-1 text-sm font-bold">{t('payment.city')}<input className="field" name="billingCity" minLength={2} maxLength={100} required /></label>
                </div>}
                {currentQuote && <div aria-live="polite"><TotalsTable totals={currentQuote.totals} /></div>}
                <RequestError error={error} />
                <button type="submit" className="button button-primary disabled:opacity-60" disabled={pending || (!shop.data.pickupEnabled && !shop.data.deliveryEnabled)}>
                  {t(pending ? 'common.loading' : currentQuote ? 'commerce.placeOrder' : 'commerce.reviewTotal')}
                </button>
              </section>
            </form>
          </>}
      </div>
    </>
  );
}
