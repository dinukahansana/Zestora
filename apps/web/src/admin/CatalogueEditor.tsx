import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError, RequestError, send } from '../commerce/api';
import type { Category, Choice, Product } from '../content/catalogue';
import { languageOf } from '../i18n';
import { Check, Field, LocalFields, Panel, Save, localOf, numberOf, valueOf } from './Fields';

interface AdminCategory extends Category { position: number; published: boolean }
interface AdminProduct extends Product { published: boolean }
interface Catalogue { categories: AdminCategory[]; products: AdminProduct[] }
const blankChoice = { id: '', name: { en: '', si: '' }, price: 0 };
const catalogueKey = ['admin', 'catalogue'];

export function Choices({ title, choices, update, required = false }: { title: string; choices: Choice[]; update: (values: Choice[]) => void; required?: boolean }) {
  const { t } = useTranslation();
  const change = (index: number, patch: Partial<Choice>) => update(choices.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <fieldset className="grid gap-3 rounded-xl border border-line p-3">
    <legend className="px-1 text-sm font-extrabold">{title}</legend>
    {choices.map((option, index) => <div key={index} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-xs font-bold">{t('admin.slug')}<input className="field" value={option.id} required pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={event => change(index, { id: event.target.value })} /></label>
      <label className="grid gap-1 text-xs font-bold">{t('admin.name')} · EN<input className="field" value={option.name.en} required onChange={event => change(index, { name: { ...option.name, en: event.target.value } })} /></label>
      <label className="grid gap-1 text-xs font-bold">{t('admin.name')} · SI<input className="field" value={option.name.si} required onChange={event => change(index, { name: { ...option.name, si: event.target.value } })} /></label>
      <label className="grid gap-1 text-xs font-bold">{t('admin.price')}<input className="field" type="number" value={option.price} min={0} max={1000000} required onChange={event => change(index, { price: Number(event.target.value) })} /></label>
      {(!required || choices.length > 1) && <button className="text-left text-xs font-extrabold underline" type="button" onClick={() => update(choices.filter((_item, i) => i !== index))}>{t('commerce.remove')}</button>}
    </div>)}
    <button className="button button-outline w-fit" type="button" onClick={() => update([...choices, blankChoice])}>{t('admin.addOption')}</button>
  </fieldset>;
}

function useSave(onSaved: () => void) {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  async function perform(action: () => Promise<void>) {
    setPending(true);
    setSaved(false);
    setError(undefined);
    try {
      await action();
      setSaved(true);
      await Promise.all([
        cache.invalidateQueries({ queryKey: catalogueKey }),
        cache.invalidateQueries({ queryKey: ['catalogue'] }),
      ]);
      onSaved();
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return { pending, saved, error, perform, setError };
}

function CategoryForm({ item, onSaved }: { item?: AdminCategory; onSaved: () => void }) {
  const { t } = useTranslation();
  const state = useSave(onSaved);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const slug = valueOf(values, 'slug');
    void state.perform(async () => {
      await send(item ? `/admin/categories/${item.slug}` : '/admin/categories', {
        slug, name: localOf(values, 'name'), position: numberOf(values, 'position'), published: values.has('published'),
      }, item ? 'PUT' : 'POST');
    });
  }
  return <form className="grid gap-3" onSubmit={submit}>
    <Field label={t('admin.slug')} name="slug" value={item?.slug} readOnly={!!item} />
    <LocalFields label={t('admin.name')} name="name" value={item?.name} />
    <Field label={t('admin.position')} name="position" value={item?.position ?? 0} type="number" min={0} max={999} />
    <Check label={t('admin.published')} name="published" value={item?.published ?? true} />
    <Save {...state} />
    {item?.published && <button type="button" className="button button-outline w-fit" disabled={state.pending} onClick={() => {
      if (window.confirm(t('admin.archivePrompt'))) void state.perform(async () => { await send(`/admin/categories/${item.slug}`, undefined, 'DELETE'); });
    }}>{t('admin.archive')}</button>}
  </form>;
}

function ProductForm({ item, categories, onSaved }: { item?: AdminProduct; categories: AdminCategory[]; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const state = useSave(onSaved);
  const [sizes, setSizes] = useState<Choice[]>(item?.sizes ?? [blankChoice]);
  const [addOns, setAddOns] = useState<Choice[]>(item?.addOns ?? []);
  const [image, setImage] = useState(item?.image ?? '');
  const [uploading, setUploading] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const grouped = localOf(values, 'ingredients');
    const en = grouped.en.split('\n').map(value => value.trim()).filter(Boolean);
    const si = grouped.si.split('\n').map(value => value.trim()).filter(Boolean);
    if (en.length !== si.length) {
      state.setError(new ApiError('INGREDIENTS_MISMATCH', 400));
      return;
    }
    void state.perform(async () => {
      const slug = valueOf(values, 'slug');
      await send(item ? `/admin/products/${item.slug}` : '/admin/products', {
        slug, category: valueOf(values, 'category'), name: localOf(values, 'name'), description: localOf(values, 'description'),
        ingredients: en.map((name, index) => ({ en: name, si: si[index] })), sizes, addOns, image,
        published: values.has('published'), featured: values.has('featured'), available: values.has('available'), demo: values.has('demo'),
      }, item ? 'PUT' : 'POST');
    });
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    state.setError(undefined);
    try {
      const result = await api<{ url: string }>('/admin/images', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      setImage(result.url);
    } catch (error) {
      state.setError(error);
    } finally {
      setUploading(false);
    }
  }
  return <form className="grid gap-3" onSubmit={submit}>
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={t('admin.slug')} name="slug" value={item?.slug} readOnly={!!item} />
      <label className="grid gap-1 text-sm font-bold">{t('menu.category')}<select className="field" name="category" defaultValue={item?.category} required>
        {categories.map(category => <option key={category.slug} value={category.slug}>{category.name[language]}</option>)}
      </select></label>
    </div>
    <LocalFields label={t('admin.name')} name="name" value={item?.name} />
    <LocalFields label={t('admin.description')} name="description" value={item?.description} multiline />
    <LocalFields label={t('admin.ingredients')} name="ingredients" optional multiline value={{
      en: item?.ingredients.map(value => value.en).join('\n') ?? '', si: item?.ingredients.map(value => value.si).join('\n') ?? '',
    }} />
    <Choices title={t('product.size')} choices={sizes} update={setSizes} required />
    <Choices title={t('product.addOns')} choices={addOns} update={setAddOns} />
    <label className="grid gap-1 text-sm font-bold">{t('admin.image')}<input className="field" value={image} onChange={event => setImage(event.target.value)} required /></label>
    <label className="grid gap-1 text-sm font-bold">{t(uploading ? 'common.loading' : 'admin.upload')}<input className="field" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => void upload(event.target.files?.[0])} /></label>
    <div className="flex flex-wrap gap-x-4">
      <Check label={t('admin.published')} name="published" value={item?.published ?? true} />
      <Check label={t('admin.featured')} name="featured" value={item?.featured} />
      <Check label={t('common.available')} name="available" value={item?.available ?? true} />
      <Check label={t('admin.demoProduct')} name="demo" value={item?.demo} />
    </div>
    <Save pending={state.pending || uploading} saved={state.saved} error={state.error} />
    {item?.published && <button className="button button-outline w-fit" type="button" disabled={state.pending} onClick={() => {
      if (window.confirm(t('admin.archivePrompt'))) void state.perform(async () => { await send(`/admin/products/${item.slug}`, undefined, 'DELETE'); });
    }}>{t('admin.archive')}</button>}
  </form>;
}

export function CatalogueEditor() {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: catalogueKey, queryFn: () => api<Catalogue>('/admin/catalogue') });
  const language = languageOf(i18n.resolvedLanguage);
  const [category, setCategory] = useState('');
  const [product, setProduct] = useState('');
  const refreshDashboard = () => void cache.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  if (!query.data) return query.isError ? <RequestError error={query.error} /> : <p role="status">{t('common.loading')}</p>;
  const categories = query.data.categories;
  const products = query.data.products;
  return <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
    <Panel title={t('admin.categories')}>
      <label className="mb-4 grid gap-1 text-sm font-bold">{t('admin.chooseRecord')}<select className="field" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">{t('admin.newCategory')}</option>
        {categories.map(item => <option key={item.slug} value={item.slug}>{item.name[language]}{item.published ? '' : ` · ${t('admin.archived')}`}</option>)}
      </select></label>
      <CategoryForm key={category} item={categories.find(item => item.slug === category)} onSaved={refreshDashboard} />
    </Panel>
    <Panel title={t('admin.products')}>
      <label className="mb-4 grid gap-1 text-sm font-bold">{t('admin.chooseRecord')}<select className="field" value={product} onChange={event => setProduct(event.target.value)}>
        <option value="">{t('admin.newProduct')}</option>
        {products.map(item => <option key={item.slug} value={item.slug}>{item.name[language]}{item.published ? '' : ` · ${t('admin.archived')}`}</option>)}
      </select></label>
      {categories.length
        ? <ProductForm key={product} item={products.find(item => item.slug === product)} categories={categories} onSaved={refreshDashboard} />
        : <p>{t('admin.categoryFirst')}</p>}
    </Panel>
  </div>;
}
