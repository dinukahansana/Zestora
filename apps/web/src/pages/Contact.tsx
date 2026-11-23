import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { PageHeading } from '../components/Storefront';
import { useShopContact } from '../content/shopSettings';
import { languageOf } from '../i18n';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'contact.nameError').max(100, 'contact.nameError'),
  email: z.email('contact.emailError'),
  message: z.string().trim().min(10, 'contact.messageError').max(1500, 'contact.messageError'),
});

function ContactForm({ recipient }: { recipient: string }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
  });

  function draft({ name, email, message }: z.infer<typeof contactSchema>) {
    const body = encodeURIComponent(`${name} <${email}>\n\n${message}`);
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(t('contact.subject'))}&body=${body}`;
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 sm:p-7">
      <h2 className="font-display text-3xl">{t('contact.form')}</h2>
      <p className="mt-2 text-sm text-muted">{t('contact.formHint')}</p>
      <form className="mt-5 grid gap-4" noValidate onSubmit={handleSubmit(draft)}>
        <label className="grid gap-1.5 text-sm font-extrabold">
          {t('contact.name')}
          <input className="field" autoComplete="name" maxLength={100} required aria-invalid={!!errors.name} aria-describedby={errors.name && 'contact-name-error'} {...register('name')} />
          {errors.name && <span id="contact-name-error" className="text-[#8c3d2f]" role="alert">{t(errors.name.message ?? 'contact.nameError')}</span>}
        </label>
        <label className="grid gap-1.5 text-sm font-extrabold">
          {t('contact.email')}
          <input className="field" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email && 'contact-email-error'} {...register('email')} />
          {errors.email && <span id="contact-email-error" className="text-[#8c3d2f]" role="alert">{t(errors.email.message ?? 'contact.emailError')}</span>}
        </label>
        <label className="grid gap-1.5 text-sm font-extrabold">
          {t('contact.message')}
          <textarea className="field min-h-28 resize-y" maxLength={1500} required aria-invalid={!!errors.message} aria-describedby={errors.message && 'contact-message-error'} {...register('message')} />
          {errors.message && <span id="contact-message-error" className="text-[#8c3d2f]" role="alert">{t(errors.message.message ?? 'contact.messageError')}</span>}
        </label>
        <button className="button button-primary w-fit" type="submit"><Mail size={16} aria-hidden="true" /> {t('contact.openEmail')}</button>
      </form>
    </section>
  );
}

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const contact = useShopContact();
  const address = contact.address[languageOf(i18n.resolvedLanguage)];
  const hours = contact.hours[languageOf(i18n.resolvedLanguage)] ?? contact.hours.en;
  const links = contact.links.filter(link => link.url);
  const hasDetails = address || contact.phone || contact.email || hours || links.length;
  return (
    <>
      <PageHeading title={t('contact.title')}><p>{t('contact.intro')}</p></PageHeading>
      <div className="container-wide section-space grid items-start gap-5 md:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-line bg-moss/45 p-5 sm:p-7">
          <h2 className="font-display text-3xl">{t('contact.details')}</h2>
          {!hasDetails && <p className="mt-3 text-muted">{t('contact.pending')}</p>}
          {hasDetails && (
            <dl className="mt-4 space-y-3">
              {address && <div><dt className="font-extrabold">{t('contact.address')}</dt><dd>{address}</dd></div>}
              {contact.phone && <div><dt className="font-extrabold">{t('contact.phone')}</dt><dd><a className="underline" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a></dd></div>}
              {contact.email && <div><dt className="font-extrabold">{t('contact.email')}</dt><dd><a className="break-words underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>}
              {hours && <div><dt className="font-extrabold">{t('contact.hours')}</dt><dd>{hours}</dd></div>}
            </dl>
          )}
          {!!links.length && <div className="mt-5 flex flex-wrap gap-3">
            {links.map(link => <a className="button button-outline" key={link.name} href={link.url} target="_blank" rel="noreferrer">{t(`contact.${link.name}`)} <ArrowUpRight size={15} aria-hidden="true" /></a>)}
          </div>}
        </section>
        {contact.email && <ContactForm recipient={contact.email} />}
      </div>
    </>
  );
}
