import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { RequestError, send } from '../commerce/api';
import { PageHeading } from '../components/Storefront';
import { formatPrice } from '../content/catalogue';
import { languageOf } from '../i18n';

interface Card {
  slug: string;
  name: string;
  available: boolean;
  startingPrice: number;
  ingredients: string[];
  reason?: string;
}
interface Result { answer?: string; source: string; products: Card[]; link?: string }

export function AssistantPage({ recommend = false }: { recommend?: boolean }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const [params] = useSearchParams();
  const product = params.get('product');
  const basedOn = product && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product) && product.length <= 80 ? product : undefined;
  const [answer, setAnswer] = useState<Result>();
  const [shownQuestion, setShownQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '').trim();
    const question = read('question');
    setBusy(true);
    setError(undefined);
    try {
      setAnswer(await send<Result>(recommend ? '/ai/recommendations' : '/ai/assistant', recommend
        ? { preference: question, language, basedOn, exclude: read('exclude').split(',').map(word => word.trim()).filter(word => word.length >= 2).slice(0, 8) }
        : { question, language, reference: read('reference') || undefined, guestKey: read('guestKey') || undefined }));
      setShownQuestion(question);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title={t(recommend ? 'ai.recommendations' : 'ai.assistant')}>
      <p>{t(recommend ? 'ai.recommendationsIntro' : 'ai.assistantIntro')}</p>
    </PageHeading>
    <div className="container-wide grid max-w-4xl gap-4 py-8">
      <form className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-7" onSubmit={event => void submit(event)}>
        <label className="grid gap-1 text-sm font-bold">{t(recommend ? 'ai.preference' : 'ai.question')}
          <textarea className="field" name="question" minLength={2} maxLength={500} rows={3} required />
        </label>
        {recommend ? <label className="grid gap-1 text-sm font-bold">{t('ai.exclude')}<input className="field" name="exclude" maxLength={300} /></label> : (
          <details className="rounded-xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-bold">{t('ai.optionalTracking')}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold">{t('commerce.reference')}<input className="field" name="reference" maxLength={22} /></label>
              <label className="grid gap-1 text-sm font-bold">{t('commerce.trackingKey')}<input className="field" name="guestKey" type="password" autoComplete="off" maxLength={43} /></label>
            </div>
          </details>
        )}
        <RequestError error={error} />
        <button type="submit" className="button button-primary w-fit" disabled={busy}>{t(busy ? 'common.loading' : recommend ? 'ai.suggest' : 'ai.ask')}</button>
      </form>
      {answer && <section aria-live="polite" className="rounded-2xl border border-line bg-moss/35 p-5 sm:p-7">
        <p className="text-sm font-bold text-muted">{t(`ai.source.${answer.source}`)}</p>
        <p className="mt-2 break-words font-extrabold">{shownQuestion}</p>
        {answer.answer && <p className="mt-2 text-muted">{answer.answer}</p>}
        <ul className="mt-4 grid gap-2">{answer.products.map(item => (
          <li key={item.slug} className="rounded-xl border border-line bg-paper p-3 text-sm">
            <Link className="text-base font-extrabold underline" to={`/menu/${item.slug}`}>{item.name}</Link>
            <p>{formatPrice(item.startingPrice, language)} · {t(item.available ? 'common.available' : 'common.soldOut')}</p>
            {!!item.ingredients.length && <p className="text-muted">{t('product.ingredients')}: {item.ingredients.join(', ')}</p>}
            {item.reason && <p className="text-muted">{item.reason}</p>}
          </li>
        ))}</ul>
        {!answer.products.length && recommend && <p>{t('ai.noPicks')}</p>}
        {answer.link && <Link className="button button-outline mt-3" to={answer.link}>{t('ai.details')}</Link>}
      </section>}
    </div>
  </>;
}
