import { z } from 'zod';

export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function localText(maxLength: number) {
  const value = z.string().trim().min(1).max(maxLength);
  return z.strictObject({ en: value, si: value });
}

const choice = z.strictObject({ id: slugSchema, name: localText(100), price: z.number().int().min(0).max(1000000) });
const uniqueChoices = (choices: { id: string }[]) => new Set(choices.map(choice => choice.id)).size === choices.length;
export const imageSchema = z.string().max(600).refine(value => /^(?:\/images\/[a-z0-9.-]+|https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9/_.,-]+)$/.test(value), 'Use an approved product image URL.');

export const categoryInput = z.strictObject({
  slug: slugSchema,
  name: localText(100),
  position: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(true),
});

export const productInput = z.strictObject({
  slug: slugSchema,
  category: slugSchema,
  name: localText(120),
  description: localText(1500),
  ingredients: z.array(localText(120)).max(50),
  image: imageSchema,
  featured: z.boolean().default(false),
  available: z.boolean().default(true),
  published: z.boolean().default(true),
  demo: z.boolean().default(false),
  sizes: z.array(choice).min(1).max(20).refine(uniqueChoices, 'Size identifiers must be unique.'),
  addOns: z.array(choice).max(30).refine(uniqueChoices, 'Add-on identifiers must be unique.'),
  recipe: z.array(z.strictObject({ stockSlug: slugSchema, units: z.number().int().min(1).max(1000000) })).max(30)
    .refine(parts => new Set(parts.map(part => part.stockSlug)).size === parts.length).default([]),
});

export type CategoryInput = z.infer<typeof categoryInput>;
export type ProductInput = z.infer<typeof productInput>;

export function productValues(product: ProductInput) {
  return { ...product, startingPrice: Math.min(...product.sizes.map(size => size.price)) };
}
