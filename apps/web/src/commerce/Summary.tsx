import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatPrice } from '../content/catalogue';
import { languageOf } from '../i18n';
import { orderingEnabled, type Order, type Totals } from './api';

export function CommerceUnavailable() {
  const { t } = useTranslation();
  return (
    <div className="container-wide py-12">
      <p className="text-muted">{t('commerce.unavailable')}</p>
      <Link className="button button-primary mt-4" to="/menu">{t('common.backMenu')}</Link>
    </div>
  );
}

export function LiveOrdering({ children }: { children: React.ReactNode }) {
  return orderingEnabled ? children : <CommerceUnavailable />;
}

export function TotalsTable({ totals }: { totals: Totals }) {
  const { t, i18n } = useTranslation();
  const lang = languageOf(i18n.resolvedLanguage);
  return (
    <dl className="grid gap-2.5 text-sm">
      <div className="flex justify-between gap-4"><dt>{t('commerce.subtotal')}</dt><dd>{formatPrice(totals.subtotal, lang)}</dd></div>
      <div className="flex justify-between gap-4"><dt>{t('commerce.discount')}</dt><dd>{formatPrice(totals.discount, lang)}</dd></div>
      <div className="flex justify-between gap-4"><dt>{t('commerce.deliveryFee')}</dt><dd>{formatPrice(totals.deliveryFee, lang)}</dd></div>
      <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-extrabold"><dt>{t('commerce.total')}</dt><dd>{formatPrice(totals.total, lang)}</dd></div>
    </dl>
  );
}

export function OrderDetails({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const lang = languageOf(i18n.resolvedLanguage);
  return (
    <section className="rounded-2xl border border-line bg-paper p-5 sm:p-7">
      <p className="text-sm font-bold">{t('commerce.reference')}</p>
      <p className="break-words text-xl font-extrabold">{order.reference}</p>
      {order.paymentEnvironment && order.paymentEnvironment !== 'live' && <p className="mt-2 text-sm font-bold text-muted">{t(`payment.${order.paymentEnvironment}`)}</p>}
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="font-extrabold">{t('commerce.orderStatus')}</dt><dd>{t(`orderStatus.${order.orderStatus}`)}</dd></div>
        <div><dt className="font-extrabold">{t('commerce.paymentStatus')}</dt><dd>{t(`paymentStatus.${order.paymentStatus}`)}</dd></div>
        <div><dt className="font-extrabold">{t('commerce.fulfillment')}</dt><dd>{t(`commerce.${order.fulfillment.type}`)}</dd></div>
        <div><dt className="font-extrabold">{t('commerce.method')}</dt><dd>{t(`paymentMethod.${order.paymentMethod}`)}</dd></div>
        {order.fulfillment.address && <div><dt className="font-extrabold">{t('commerce.address')}</dt><dd>{order.fulfillment.address}</dd></div>}
        {order.fulfillment.preferredAt && <div><dt className="font-extrabold">{t('commerce.preferredAt')}</dt><dd>{new Date(order.fulfillment.preferredAt).toLocaleString(lang === 'si' ? 'si-LK' : 'en-LK')}</dd></div>}
      </dl>
      <ul className="my-5 grid gap-2 border-y border-line py-4 text-sm">
        {order.items.map(line => (
          <li key={[line.productSlug, line.size.id, ...line.addOns.map(item => item.id)].join(':')} className="flex justify-between gap-3">
            <span>{line.quantity} × {line.name[lang]} · {line.size.name[lang]}{line.addOns.map(addOn => ' + ' + addOn.name[lang])}</span>
            <span className="shrink-0 font-bold">{formatPrice(line.total, lang)}</span>
          </li>
        ))}
      </ul>
      <TotalsTable totals={order.totals} />
    </section>
  );
}
