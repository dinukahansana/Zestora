import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, send, type Shop } from '../commerce/api';
import type { Choice, LocalText } from '../content/catalogue';
import type { Presentation } from '../content/shopSettings';
import { languageOf } from '../i18n';
import { Choices } from './CatalogueEditor';
import { Check, Field, LocalFields, Panel, Save, localOf, numberOf, valueOf } from './Fields';

interface Stock { slug: string; name: LocalText; unit: string; onHand: number; threshold: number }
interface Coupon { code: string; type: 'percent' | 'fixed'; value: number; active: boolean; minimumOrder: number; usageLimit?: number; expiresAt?: string; uses: number }
interface Settings extends Shop { presentation: Presentation; notificationsEnabled: boolean; aiEnabled: boolean }

function useEdit(section: string) {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  async function put(path: string, body: unknown) {
    setPending(true);
    setSaved(false);
    setError(undefined);
    try {
      await send(path, body, 'PUT');
      setSaved(true);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['admin', section] }),
        cache.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
        ...(section === 'settings' ? [
          cache.invalidateQueries({ queryKey: ['checkout-settings'] }),
          cache.invalidateQueries({ queryKey: ['shop-presentation'] }),
        ] : []),
      ]);
    } catch (error) { setError(error); }
    finally { setPending(false); }
  }
  return { pending, saved, error, put };
}

function StockForm({ item }: { item?: Stock }) {
  const { t } = useTranslation();
  const editor = useEdit('inventory');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void editor.put(`/admin/inventory/${encodeURIComponent(valueOf(form, 'slug'))}`, {
      name: localOf(form, 'stock'), unit: valueOf(form, 'unit'), onHand: numberOf(form, 'onHand'), threshold: numberOf(form, 'threshold'),
    });
  }
  return <form className="grid gap-3" onSubmit={submit}>
    <Field label={t('admin.slug')} name="slug" value={item?.slug} readOnly={!!item} />
    <LocalFields label={t('admin.name')} name="stock" value={item?.name} />
    <Field label={t('admin.unit')} name="unit" value={item?.unit} />
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={t('admin.onHand')} name="onHand" type="number" min={0} value={item?.onHand ?? 0} />
      <Field label={t('admin.threshold')} name="threshold" type="number" min={0} value={item?.threshold ?? 0} />
    </div>
    <Save {...editor} />
  </form>;
}

function localDateTime(date?: string) {
  if (!date) return undefined;
  const time = new Date(date);
  return new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function CouponForm({ item }: { item?: Coupon }) {
  const { t } = useTranslation();
  const editor = useEdit('coupons');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expiry = valueOf(form, 'expiresAt');
    const usageLimit = valueOf(form, 'usageLimit');
    void editor.put(`/admin/coupons/${encodeURIComponent(valueOf(form, 'code'))}`, {
      type: valueOf(form, 'type'), value: numberOf(form, 'value'), minimumOrder: numberOf(form, 'minimum'),
      active: form.has('active'), expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
    });
  }
  return <form className="grid gap-3" onSubmit={submit}>
    <Field label={t('admin.couponCode')} name="code" value={item?.code} readOnly={!!item} />
    <label className="grid gap-1 text-sm font-bold">{t('admin.discountType')}<select className="field" name="type" defaultValue={item?.type ?? 'percent'}>
      <option value="percent">{t('admin.percent')}</option><option value="fixed">{t('admin.fixed')}</option>
    </select></label>
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={t('admin.value')} name="value" type="number" min={1} value={item?.value ?? 10} />
      <Field label={t('admin.minimum')} name="minimum" type="number" min={0} value={item?.minimumOrder ?? 0} />
      <Field label={t('admin.expiry')} name="expiresAt" type="datetime-local" optional value={localDateTime(item?.expiresAt)} />
      <Field label={t('admin.usageLimit')} name="usageLimit" type="number" min={1} optional value={item?.usageLimit} />
    </div>
    {item && <p className="text-sm text-muted">{t('admin.redeemed', { count: item.uses })}</p>}
    <Check label={t('admin.active')} name="active" value={item?.active ?? true} />
    <Save {...editor} />
  </form>;
}

export function StockCouponsAdmin() {
  const { t, i18n } = useTranslation();
  const lang = languageOf(i18n.resolvedLanguage);
  const [stock, setStock] = useState('');
  const [coupon, setCoupon] = useState('');
  const inventory = useQuery({ queryKey: ['admin', 'inventory'], queryFn: () => api<{ items: Stock[] }>('/admin/inventory') });
  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api<{ items: Coupon[] }>('/admin/coupons') });
  return <div className="grid items-start gap-4 lg:grid-cols-2">
    <Panel title={t('admin.inventory')}>
      <RequestError error={inventory.error} />
      <label className="mb-4 grid gap-1 text-sm font-bold">{t('admin.chooseRecord')}<select className="field" value={stock} onChange={event => setStock(event.target.value)}>
        <option value="">{t('admin.newStock')}</option>
        {inventory.data?.items.map(item => <option value={item.slug} key={item.slug}>{item.name[lang]} · {item.onHand} {item.unit}</option>)}
      </select></label>
      <StockForm key={stock} item={inventory.data?.items.find(item => item.slug === stock)} />
    </Panel>
    <Panel title={t('admin.coupons')}>
      <RequestError error={coupons.error} />
      <label className="mb-4 grid gap-1 text-sm font-bold">{t('admin.chooseRecord')}<select className="field" value={coupon} onChange={event => setCoupon(event.target.value)}>
        <option value="">{t('admin.newCoupon')}</option>
        {coupons.data?.items.map(item => <option value={item.code} key={item.code}>{item.code}</option>)}
      </select></label>
      <CouponForm key={coupon} item={coupons.data?.items.find(item => item.code === coupon)} />
    </Panel>
  </div>;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const editor = useEdit('settings');
  const details = settings.presentation;
  const [zones, setZones] = useState<Choice[]>(settings.deliveryZones.map(zone => ({ id: zone.id, name: zone.name, price: zone.fee })));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const presentation = {
      name: valueOf(form, 'shopName'), logo: valueOf(form, 'logo'), phone: valueOf(form, 'phone'), email: valueOf(form, 'email'),
      address: localOf(form, 'address'), hours: localOf(form, 'hours'), defaultLanguage: valueOf(form, 'defaultLanguage'), currency: 'LKR',
      map: valueOf(form, 'map'), whatsapp: valueOf(form, 'whatsapp'), instagram: valueOf(form, 'instagram'), facebook: valueOf(form, 'facebook'),
    };
    void editor.put('/admin/settings', {
      pickupEnabled: form.has('pickupEnabled'), deliveryEnabled: form.has('deliveryEnabled'), minimumOrder: numberOf(form, 'minimum'),
      deliveryZones: zones.map(zone => ({ id: zone.id, name: zone.name, fee: zone.price })), presentation,
      notificationsEnabled: form.has('notificationsEnabled'), aiEnabled: form.has('aiEnabled'),
    });
  }
  return <form className="grid max-w-4xl gap-4" onSubmit={submit}>
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={t('admin.shopName')} name="shopName" value={details.name} />
      <Field label={t('admin.logo')} name="logo" optional value={details.logo} />
      <Field label={t('contact.phone')} name="phone" optional value={details.phone} />
      <Field label={t('contact.email')} name="email" type="email" optional value={details.email} />
    </div>
    <LocalFields label={t('contact.address')} name="address" optional value={details.address} />
    <LocalFields label={t('contact.hours')} name="hours" optional value={details.hours} />
    <div className="grid gap-2 sm:grid-cols-2">
      {(['map', 'whatsapp', 'instagram', 'facebook'] as const).map(key => <Field label={t(`contact.${key}`)} name={key} key={key} type="url" optional value={details[key]} />)}
      <Field label={t('admin.minimum')} name="minimum" type="number" min={0} value={settings.minimumOrder} />
      <label className="grid gap-1 text-sm font-bold">{t('admin.defaultLanguage')}<select className="field" name="defaultLanguage" defaultValue={details.defaultLanguage}>
        <option value="en">English</option><option value="si">සිංහල</option>
      </select></label>
    </div>
    <Choices title={t('admin.zones')} choices={zones} update={setZones} />
    <div className="flex flex-wrap gap-x-5">
      <Check label={t('commerce.pickup')} name="pickupEnabled" value={settings.pickupEnabled} />
      <Check label={t('commerce.delivery')} name="deliveryEnabled" value={settings.deliveryEnabled} />
      <Check label={t('admin.notifications')} name="notificationsEnabled" value={settings.notificationsEnabled} />
      <Check label={t('admin.ai')} name="aiEnabled" value={settings.aiEnabled} />
    </div>
    <Save {...editor} />
  </form>;
}

export function SettingsAdmin() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Settings>('/admin/settings') });
  return <Panel title={t('admin.settings')}>
    <RequestError error={query.error} />
    {query.data && <SettingsForm settings={query.data} />}
    {query.isPending && <p role="status">{t('common.loading')}</p>}
  </Panel>;
}
