import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parseInput } from '../http.ts';
import { Category, Product } from './models.ts';
import { slugSchema } from './schemas.ts';

const options = z.strictObject({
  category: slugSchema.optional(),
  available: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  featured: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  sort: z.enum(['featured', 'low', 'high', 'name']).default('featured'),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

const publicFields = '-_id -__v -createdAt -updatedAt -published';
const sortOrder = {
  featured: { featured: -1, slug: 1 },
  low: { startingPrice: 1, slug: 1 },
  high: { startingPrice: -1, slug: 1 },
  name: { 'name.en': 1, slug: 1 },
} as const;

export const catalogueRouter = Router();

async function publishedCategories() {
  return Category.find({ published: true }).select(publicFields).sort({ position: 1, slug: 1 }).lean();
}

catalogueRouter.get('/categories', async (_request, response) => {
  response.json({ items: await publishedCategories() });
});

catalogueRouter.get('/catalogue', async (_request, response) => {
  const categories = await publishedCategories();
  const products = await Product.find({ published: true, category: { $in: categories.map(category => category.slug) } })
    .select(publicFields).sort(sortOrder.featured).lean();
  response.json({ categories, products });
});

catalogueRouter.get('/products', async (request, response) => {
  const { category, available, featured, sort, offset, limit } = parseInput(options, request.query);
  const active = await publishedCategories();
  const permittedCategories = active.map(item => item.slug).filter(slug => !category || category === slug);
  const filter = {
    published: true,
    category: { $in: permittedCategories },
    ...(available === undefined ? {} : { available }),
    ...(featured === undefined ? {} : { featured }),
  };
  const [items, total] = await Promise.all([
    Product.find(filter).select(publicFields).sort(sortOrder[sort]).skip(offset).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  response.json({ items, offset, limit, total });
});

catalogueRouter.get('/products/:slug', async (request, response) => {
  const slug = parseInput(slugSchema, request.params.slug);
  const item = await Product.findOne({ slug, published: true }).select(publicFields).lean();
  if (!item || !(await Category.exists({ slug: item.category, published: true }))) {
    throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'The product was not found.');
  }
  response.json({ item });
});
