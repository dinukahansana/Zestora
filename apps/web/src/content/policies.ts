import type { LocalText } from './catalogue';

export type PolicyKind = 'privacy' | 'terms' | 'refunds' | 'cancellation';

export interface PolicyPublication {
  content: LocalText;
  version: number;
  publishedAt: string;
}

export interface PolicyDraft {
  slug: PolicyKind;
  draft: LocalText;
  draftVersion: number;
  published: PolicyPublication | null;
}
