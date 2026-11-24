import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api, ApiError, RequestError, send } from '../commerce/api';
import type { PolicyDraft, PolicyKind } from '../content/policies';
import { Panel } from './Fields';

function PolicyEditor({ item, update, reload }: {
  item: PolicyDraft;
  update: (item: PolicyDraft) => void;
  reload: () => Promise<PolicyDraft>;
}) {
  const { t } = useTranslation();
  const [record, setRecord] = useState(item);
  const [draft, setDraft] = useState(item.draft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState('');
  const dirty = draft.en !== record.draft.en || draft.si !== record.draft.si;
  const complete = !!draft.en.trim() && !!draft.si.trim();
  const liveVersion = record.published?.version;

  async function apply(change: () => Promise<PolicyDraft>, message: string) {
    setPending(true);
    setError(undefined);
    setStatus('');
    try {
      const next = await change();
      setRecord(next);
      setDraft(next.draft);
      setStatus(message);
      update(next);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !dirty) return;
    void apply(async () => (await send<{ item: PolicyDraft }>('/admin/policies/' + item.slug + '/draft', {
      draft, version: record.draftVersion,
    }, 'PUT')).item, 'policy.editor.saved');
  }

  function publish() {
    if (pending || dirty || !complete || liveVersion === record.draftVersion) return;
    void apply(async () => (await send<{ item: PolicyDraft }>('/admin/policies/' + item.slug + '/publish', {
      version: record.draftVersion,
    })).item, 'policy.editor.published');
  }

  return <div className="grid gap-5">
    {record.published && <p className="text-sm text-muted">
      {t('policy.editor.liveVersion', { version: liveVersion })}{' '}
      <Link className="font-bold underline" to={'/' + item.slug}>{t('policy.editor.viewPublic')}</Link>
    </p>}
    <form className="grid gap-4" onSubmit={save}>
      <div className="grid gap-4 md:grid-cols-2">
        {(['en', 'si'] as const).map(language => (
          <label className="grid min-w-0 gap-1 text-sm font-bold" key={language}>
            {t('policy.editor.' + language)}
            <textarea className="field min-h-44 resize-y" lang={language} maxLength={6000} disabled={pending}
              value={draft[language]} onChange={event => {
                setDraft({ ...draft, [language]: event.target.value });
                setStatus('');
              }} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button button-outline" disabled={pending || !dirty}>{t('policy.editor.save')}</button>
        <button type="button" className="button button-primary" onClick={publish}
          disabled={pending || dirty || !complete || record.draftVersion === 0 || liveVersion === record.draftVersion}>
          {t('policy.editor.publish')}
        </button>
      </div>
      <p className="text-sm text-muted">{t('policy.editor.hint')}</p>
      {pending && <p role="status">{t('common.loading')}</p>}
      {status && <p role="status" className="font-bold">{t(status)}</p>}
      <RequestError error={error} />
      {error instanceof ApiError && error.status === 409 && (
        <button type="button" className="button button-outline w-fit" disabled={pending}
          onClick={() => void apply(reload, 'policy.editor.reloaded')}>{t('policy.editor.reload')}</button>
      )}
    </form>
    <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer font-bold">{t('policy.editor.preview')}</summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(['en', 'si'] as const).map(language => (
          <div className="min-w-0" key={language}>
            <h3 className="font-bold">{t('policy.editor.' + language)}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm" lang={language}>
              {draft[language] || t('policy.editor.empty')}
            </p>
          </div>
        ))}
      </div>
    </details>
  </div>;
}

const editorKey = ['admin', 'policies'];

export function PoliciesAdmin() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [slug, setSlug] = useState<PolicyKind>('privacy');
  const policies = useQuery({ queryKey: editorKey, queryFn: () => api<{ items: PolicyDraft[] }>('/admin/policies') });
  const item = policies.data?.items.find(item => item.slug === slug);

  function update(next: PolicyDraft) {
    cache.setQueryData<{ items: PolicyDraft[] }>(editorKey, data => data && {
      items: data.items.map(item => item.slug === next.slug ? next : item),
    });
    void cache.invalidateQueries({ queryKey: ['shop-policy', next.slug] });
  }

  return <Panel title={t('admin.policies')}>
    {policies.isPending && <p role="status">{t('common.loading')}</p>}
    <RequestError error={policies.error} />
    {item && <div className="grid gap-5">
      <label className="grid max-w-xs gap-1 text-sm font-bold">{t('policy.editor.choose')}
        <select className="field" value={slug} onChange={event => setSlug(event.target.value as PolicyKind)}>
          {policies.data?.items.map(row => <option key={row.slug} value={row.slug}>{t('policy.' + row.slug + '.title')}</option>)}
        </select>
      </label>
      <PolicyEditor key={slug} item={item} update={update} reload={async () => {
        const response = await policies.refetch({ throwOnError: true });
        const latest = response.data?.items.find(row => row.slug === slug);
        if (!latest) throw new Error('Policy draft missing.');
        return latest;
      }} />
    </div>}
  </Panel>;
}
