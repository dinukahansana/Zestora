import { categories, products } from '../apps/web/src/content/catalogue.ts';
import { Category, Product } from '../apps/api/src/catalogue/models.ts';
import { categoryInput, productInput, productValues } from '../apps/api/src/catalogue/schemas.ts';
import { readConfig } from '../apps/api/src/config.ts';
import { connectDatabase, disconnectDatabase } from '../apps/api/src/database.ts';

const { mongoUri } = readConfig();
if (!mongoUri) throw new Error('Set MONGODB_URI to a development or demo database before seeding.');

try {
  await connectDatabase(mongoUri);
  const categoryRows = categories.map((item, position) => categoryInput.parse({ ...item, position }));
  const productRows = products.map(item => productValues(productInput.parse({ ...item, demo: true })));
  const now = new Date();
  const insertedCategories = await Category.bulkWrite(categoryRows.map(item => ({
    updateOne: { filter: { slug: item.slug }, update: { $setOnInsert: { ...item, createdAt: now, updatedAt: now } }, upsert: true, timestamps: false },
  })));
  const insertedProducts = await Product.bulkWrite(productRows.map(item => ({
    updateOne: { filter: { slug: item.slug }, update: { $setOnInsert: { ...item, createdAt: now, updatedAt: now } }, upsert: true, timestamps: false },
  })));
  console.log(`Inserted ${insertedCategories.upsertedCount} demo categories and ${insertedProducts.upsertedCount} demo products. Existing records were preserved.`);
} catch (error) {
  console.error('Demo seed failed:', error instanceof Error ? error.name : 'Unknown');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
