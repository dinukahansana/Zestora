import { model, Schema } from 'mongoose';
import type { CategoryInput, ProductInput } from './schemas.ts';

const localText = new Schema({ en: { type: String, required: true }, si: { type: String, required: true } }, { _id: false });
const choice = new Schema({
  id: { type: String, required: true },
  name: { type: localText, required: true },
  price: { type: Number, min: 0, required: true },
}, { _id: false });

const categorySchema = new Schema<CategoryInput>({
  slug: { type: String, required: true, unique: true },
  name: { type: localText, required: true },
  position: { type: Number, min: 0, default: 0 },
  published: { type: Boolean, default: true },
}, { timestamps: true });

export type ProductRecord = ProductInput & { startingPrice: number };

const productSchema = new Schema<ProductRecord>({
  slug: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  name: { type: localText, required: true },
  description: { type: localText, required: true },
  ingredients: { type: [localText], default: [] },
  image: { type: String, required: true },
  featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  published: { type: Boolean, default: true },
  demo: { type: Boolean, default: false },
  sizes: { type: [choice], required: true },
  addOns: { type: [choice], default: [] },
  startingPrice: { type: Number, min: 0, required: true },
}, { timestamps: true });

productSchema.index({ published: 1, category: 1, startingPrice: 1 });

export const Category = model('Category', categorySchema);
export const Product = model('Product', productSchema);
