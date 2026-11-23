import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestError } from '../commerce/api';
import type { LocalText } from '../content/catalogue';

export const valueOf = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export const numberOf = (form: FormData, key: string) => Number(valueOf(form, key));
export const localOf = (form: FormData, key: string) => ({ en: valueOf(form, key + 'En'), si: valueOf(form, key + 'Si') });

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-line bg-paper p-4 sm:p-6"><h2 className="mb-4 font-display text-2xl">{title}</h2>{children}</section>;
}

export function Field({ label, name, value, type = 'text', optional = false, readOnly = false, min, max }: {
  label: string; name: string; value?: string | number; type?: string; optional?: boolean; readOnly?: boolean; min?: number; max?: number;
}) {
  return <label className="grid gap-1 text-sm font-bold">{label}<input className="field" name={name} type={type} defaultValue={value} required={!optional} readOnly={readOnly} min={min} max={max} maxLength={500} /></label>;
}

export function LocalFields({ label, name, value, multiline = false, optional = false }: { label: string; name: string; value?: LocalText; multiline?: boolean; optional?: boolean }) {
  return <div className="grid gap-2 sm:grid-cols-2">
    {(['en', 'si'] as const).map(language => (
      <label className="grid gap-1 text-sm font-bold" key={language}>
        {label} · <span className="sr-only">{language === 'en' ? 'English' : 'සිංහල'}</span><span aria-hidden="true">{language.toUpperCase()}</span>
        {multiline
          ? <textarea className="field" name={name + (language === 'en' ? 'En' : 'Si')} defaultValue={value?.[language]} required={!optional} rows={3} maxLength={1500} />
          : <input className="field" name={name + (language === 'en' ? 'En' : 'Si')} defaultValue={value?.[language]} required={!optional} maxLength={350} />}
      </label>
    ))}
  </div>;
}

export function Check({ label, name, value }: { label: string; name: string; value?: boolean }) {
  return <label className="flex min-h-9 items-center gap-2.5 text-sm font-bold"><input type="checkbox" name={name} defaultChecked={value} className="size-4 accent-forest" />{label}</label>;
}

export function Save({ pending, error, saved }: { pending: boolean; error: unknown; saved?: boolean }) {
  const { t } = useTranslation();
  return <>
    <RequestError error={error} />
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className="button button-primary" disabled={pending}>{t(pending ? 'common.loading' : 'account.save')}</button>
      {saved && !pending && <span role="status" className="text-sm font-extrabold">{t('admin.saved')}</span>}
    </div>
  </>;
}

export function Pager({ offset, total, onChange }: { offset: number; total: number; onChange: (next: number) => void }) {
  const { t } = useTranslation();
  return total > 50 && <div className="mt-4 flex items-center gap-3">
    <button type="button" disabled={offset === 0} className="button button-outline disabled:opacity-50" onClick={() => onChange(Math.max(0, offset - 50))}>{t('admin.previous')}</button>
    <span className="text-sm text-muted">{offset + 1}–{Math.min(offset + 50, total)} / {total}</span>
    <button type="button" disabled={offset + 50 >= total} className="button button-outline disabled:opacity-50" onClick={() => onChange(offset + 50)}>{t('admin.next')}</button>
  </div>;
}
