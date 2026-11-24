import { Router } from 'express';
import { model, Schema } from 'mongoose';
import { z } from 'zod';
import { parseInput } from './http.ts';
import type { LocalText } from './ordering/schemas.ts';

export const policyKinds = ['privacy', 'terms', 'refunds', 'cancellation'] as const;
export const policyKind = z.enum(policyKinds);
export type PolicyKind = z.infer<typeof policyKind>;

const maxLength = 6000;
const text = z.string().trim().max(maxLength);
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const policyDraftInput = z.strictObject({ draft: z.strictObject({ en: text, si: text }), version });
export const policyPublishInput = z.strictObject({ version: version.min(1) });

interface Publication {
  content: LocalText;
  version: number;
  publishedAt: Date;
}
interface PolicyRecord {
  slug: PolicyKind;
  draft: LocalText;
  draftVersion: number;
  published?: Publication;
}

const contentSchema = new Schema<LocalText>({
  en: { type: String, maxlength: maxLength, default: '' },
  si: { type: String, maxlength: maxLength, default: '' },
}, { _id: false });

const publicationSchema = new Schema<Publication>({
  content: { type: contentSchema, required: true },
  version: { type: Number, required: true },
  publishedAt: { type: Date, required: true },
}, { _id: false });

const schema = new Schema<PolicyRecord>({
  slug: { type: String, enum: policyKinds, unique: true, required: true },
  draft: { type: contentSchema, required: true },
  draftVersion: { type: Number, required: true },
  published: publicationSchema,
}, { timestamps: true, minimize: false });

export const ShopPolicy = model('ShopPolicy', schema);

export function policyEditorView(slug: PolicyKind, record?: PolicyRecord | null) {
  return {
    slug, draft: record?.draft ?? { en: '', si: '' }, draftVersion: record?.draftVersion ?? 0,
    published: record?.published ?? null,
  };
}

export async function publishedPolicy(slug: PolicyKind) {
  const record = await ShopPolicy.findOne({ slug }).select('published -_id').lean();
  return record?.published ?? null;
}

export const storefrontPoliciesRouter = Router();
storefrontPoliciesRouter.get('/:slug', async (request, response) => {
  const slug = parseInput(policyKind, request.params.slug);
  response.set('Cache-Control', 'no-store').json({ item: await publishedPolicy(slug) });
});
