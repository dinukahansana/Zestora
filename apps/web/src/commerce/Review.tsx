import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { languageOf } from '../i18n';
import { RequestError, send, type Order } from './api';

export function ReviewForm({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const products = [...new Map(order.items.map(line => [line.productSlug, line])).values()];
  const [error, setError] = useState<unknown>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setSent(false);
    setError(undefined);
    try {
      await send('/reviews', {
        reference: order.reference, productSlug: data.get('product'), rating: Number(data.get('rating')),
        text: data.get('review'), language,
      });
      form.reset();
      setSent(true);
    } catch (error) { setError(error); }
    finally { setPending(false); }
  }
  return <form className="grid gap-3 rounded-2xl border border-line bg-paper p-5" onSubmit={event => void submit(event)}>
    <h2 className="font-display text-2xl">{t('ai.leaveReview')}</h2>
    <label className="grid gap-1 text-sm font-bold">{t('ai.reviewProduct')}<select className="field" name="product">
      {products.map(item => <option key={item.productSlug} value={item.productSlug}>{item.name[language]}</option>)}
    </select></label>
    <label className="grid gap-1 text-sm font-bold">{t('ai.rating')}<select className="field" name="rating" defaultValue="5">
      {[5, 4, 3, 2, 1].map(rating => <option key={rating}>{rating}</option>)}
    </select></label>
    <label className="grid gap-1 text-sm font-bold">{t('ai.review')}<textarea className="field" name="review" minLength={5} maxLength={1000} required /></label>
    <RequestError error={error} />
    {sent && <p role="status">{t('ai.reviewSent')}</p>}
    <button type="submit" className="button button-primary w-fit" disabled={pending}>{t('ai.submitReview')}</button>
  </form>;
}
