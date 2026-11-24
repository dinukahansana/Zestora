import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { currentShop } from '../admin/settings.ts';
import { withStockAvailability } from '../catalogue/availability.ts';
import { Category, Product, type ProductRecord } from '../catalogue/models.ts';
import { slugSchema } from '../catalogue/schemas.ts';
import { Order } from '../ordering/models.ts';
import { guestKeySchema, orderReference } from '../ordering/schemas.ts';
import { publishedPolicy, type PolicyKind } from '../policies.ts';
import { purchasedTogether } from './pairings.ts';
import { redact } from './provider.ts';
import type { AiRunner } from './runner.ts';

type PublicProduct = Omit<ProductRecord, 'recipe'>;
export type Language = 'en' | 'si';
const languageSchema = z.enum(['en', 'si']).default('en');
const question = z.string().trim().min(2).max(500);
export const assistantInput = z.strictObject({
  question, language: languageSchema, reference: orderReference.optional(), guestKey: guestKeySchema.optional(),
});
export const recommendationInput = z.strictObject({
  preference: question, language: languageSchema, basedOn: slugSchema.optional(),
  exclude: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
});

const intents = ['products', 'hours', 'fulfillment', 'policies', 'support'] as const;
const recognition = z.strictObject({ intent: z.enum(intents), slugs: z.array(z.string()).max(6) });
const picked = z.strictObject({ slugs: z.array(z.string()).max(6) });
const normalize = (value: string) => value.normalize('NFC').toLocaleLowerCase();
const orderLabels: Record<string, [string, string]> = {
  pending: ['Pending', 'පොරොත්තුවෙන්'], confirmed: ['Confirmed', 'තහවුරු කර ඇත'],
  preparing: ['Preparing', 'සකස් කරමින්'], ready_for_pickup: ['Ready for pickup', 'රැගෙන යාමට සූදානම්'],
  out_for_delivery: ['Out for delivery', 'බෙදාහැරීමට පිටත් වී ඇත'], completed: ['Completed', 'සම්පූර්ණයි'], cancelled: ['Cancelled', 'අවලංගු කර ඇත'],
};

async function productsForAssistant() {
  const categories = await Category.find({ published: true }).select('slug').lean();
  const products = await Product.find({ published: true, category: { $in: categories.map(category => category.slug) } })
    .select('slug name description ingredients available featured category startingPrice sizes addOns recipe').sort({ featured: -1, slug: 1 }).lean();
  return withStockAvailability(products);
}

function productView(item: PublicProduct, language: Language) {
  return {
    slug: item.slug, name: item.name[language], available: item.available, category: item.category,
    startingPrice: item.startingPrice, ingredients: item.ingredients.map(ingredient => ingredient[language]),
  };
}

function searchScore(item: PublicProduct, search: string) {
  const words = normalize(search).split(/[^\p{L}\p{M}\p{N}]+/u).filter(word => word.length > 1);
  const text = normalize([item.slug, item.category, item.name.en, item.name.si, item.description.en, item.description.si,
    ...item.ingredients.flatMap(ingredient => Object.values(ingredient))].join(' '));
  return words.filter(word => text.includes(word)).length;
}

function findIntent(message: string): typeof intents[number] {
  if (/\b(hours?|opening|open today|close[ds]?)\b|විවෘත|වේලාව/u.test(message)) return 'hours';
  if (/\b(delivery|pickup|pick.up|deliver)\b|බෙදා|රැගෙන/u.test(message)) return 'fulfillment';
  if (/\b(policy|policies|refund|cancell?ation|privacy|terms)\b|ප්‍රතිපත්ති|අවලංගු/u.test(message)) return 'policies';
  return 'products';
}

function pickVerified(items: PublicProduct[], slugs: string[], limit: number) {
  return [...new Set(slugs)].flatMap(slug => {
    const item = items.find(product => product.slug === slug);
    return item ? [item] : [];
  }).slice(0, limit);
}

const policyTopics: readonly [PolicyKind, RegExp][] = [
  ['refunds', /\b(refunds?|return policy|money back|reimburse\w*)\b|ආපසු ගෙව|මුදල් ආපසු/u],
  ['cancellation', /\b(cancel(?:led|ed|s|ling|ing)?|cancellation)\b|අවලංගු/u],
  ['privacy', /\b(privacy|personal data|data protection)\b|පෞද්ගලිකත්වය|පෞද්ගලික දත්ත|පුද්ගලික දත්ත/u],
  ['terms', /\b(terms|conditions of sale)\b|නියමයන්|කොන්දේසි/u],
];

function policyExcerpt(content: string, question: string) {
  const words = [...new Set(normalize(question).match(/[\p{L}\p{M}]{3,}/gu) ?? [])];
  const paragraphs = content.split(/\r?\n[ \t]*\r?\n/u).map(part => part.trim()).filter(Boolean);
  let passage = paragraphs[0] ?? content;
  let best = 0;
  for (const paragraph of paragraphs) {
    const text = normalize(paragraph);
    const score = words.filter(word => text.includes(word)).length;
    if (score > best) {
      best = score;
      passage = paragraph;
    }
  }
  return passage;
}

async function policyAnswer(slug: PolicyKind, language: Language, question: string) {
  const published = await publishedPolicy(slug);
  if (!published) return {
    answer: language === 'si' ? 'මෙම ප්‍රතිපත්තිය තවම පළ කර නැත. විස්තර සඳහා වෙළඳසැල අමතන්න.' : 'The shop has yet to publish this policy. Contact the shop for details.',
    source: 'fallback', products: [], link: '/contact',
  };
  return {
    answer: policyExcerpt(published.content[language], question), source: 'policy', products: [],
    link: '/' + slug, policyVersion: published.version,
  };
}

export async function assistant(data: z.infer<typeof assistantInput>, runner: AiRunner, customerId?: Types.ObjectId) {
  const si = data.language === 'si';
  if (data.reference) {
    const owners = [
      ...(customerId ? [{ userId: customerId }] : []),
      ...(data.guestKey ? [{ guestHash: createHash('sha256').update(data.guestKey).digest('hex') }] : []),
    ];
    const order = owners.length ? await Order.findOne({ reference: data.reference, $or: owners }).select('orderStatus').lean() : null;
    const answer = order
      ? (si ? 'ඇණවුමේ තත්ත්වය: ' : 'Order status: ') + orderLabels[order.orderStatus][si ? 1 : 0]
      : si ? 'ඇණවුම බැලීමට පිවිසෙන්න හෝ නිවැරදි ලුහුබැඳීමේ යතුර ලබා දෙන්න.' : 'Sign in as the order owner or provide the correct guest tracking key.';
    return { answer, source: 'verified', products: [], link: order ? undefined : '/track' };
  }

  const messages = normalize(data.question);
  const topic = policyTopics.find(([, pattern]) => pattern.test(messages));
  if (topic) return policyAnswer(topic[0], data.language, data.question);

  const shop = await currentShop();
  const products = await productsForAssistant();
  const ranked = products.map(item => ({ item, score: searchScore(item, messages) })).sort((a, b) => b.score - a.score);
  const mentioned = ranked.filter(entry => entry.score > 0).map(entry => entry.item);
  const intent = findIntent(messages);
  const publicCards = ranked.slice(0, 18).map(({ item }) => productView(item, data.language));
  const model = shop.aiEnabled ? await runner.complete('assistant',
    'Classify a juice shop question as products, hours, fulfillment, policies, or support. Return JSON with an intent and slugs array containing only relevant values from the supplied catalogue. For an unrelated question select support. Never provide prices or health claims in the response.',
    { question: redact(data.question), language: data.language, catalogue: publicCards }, recognition) : undefined;
  const source = model ? 'ai' : 'fallback';
  switch (model?.intent ?? intent) {
    case 'hours': {
      const hours = shop.presentation.hours[data.language] || shop.presentation.hours.en;
      return { answer: hours || (si ? 'විවෘත වේලාවන් සඳහා වෙළඳසැල අමතන්න.' : 'Contact the shop for opening hours.'), source, products: [], link: '/contact' };
    }
    case 'fulfillment': {
      const choices = [
        ...(shop.pickupEnabled ? [si ? 'වෙළඳසැලෙන් රැගෙන යාම' : 'Shop pickup'] : []),
        ...(shop.deliveryEnabled ? [si ? 'නිවසට බෙදාහැරීම' : 'Home delivery'] : []),
      ];
      return { answer: choices.join(' · ') || (si ? 'ලබාගැනීමේ ක්‍රම සඳහා වෙළඳසැල අමතන්න.' : 'Contact the shop for fulfilment options.'), source, products: [], link: '/menu' };
    }
    case 'policies':
      return { answer: si ? 'නවතම ප්‍රතිපත්ති සඳහා වෙළඳසැලේ උපකාර පිටු බලන්න.' : 'Check the shop help pages for the current policies.', source, products: [], link: '/faq' };
    case 'products': {
      const matches = model ? pickVerified(products, model.slugs, 5) : mentioned.slice(0, 5);
      if (matches.length) return {
        answer: si ? 'මෙන්න මෙනුවේ තහවුරු කළ තොරතුරු.' : 'Here are the matching items from the current menu.',
        source, products: matches.map(item => productView(item, data.language)), link: '/menu',
      };
      break;
    }
  }
  return { answer: si ? 'මෙනුවේ නිෂ්පාදනයක් ගැන අසන්න හෝ වෙළඳසැල අමතන්න.' : 'Ask about a menu item or contact the shop for help.', source, products: [], link: '/contact' };
}

export async function recommendations(data: z.infer<typeof recommendationInput>, runner: AiRunner, customerId?: Types.ObjectId) {
  const shop = await currentShop();
  const orders = customerId ? await Order.find({ userId: customerId, orderStatus: 'completed', paymentEnvironment: { $nin: ['sandbox', 'simulator'] } }).sort({ createdAt: -1 }).limit(20).select('items.productSlug').lean() : [];
  const history = new Set(orders.flatMap(order => order.items.map(item => item.productSlug)));
  const catalogue = await productsForAssistant();
  const published = new Set(catalogue.map(item => item.slug));
  const seeds = (data.basedOn ? [data.basedOn] : [...history].slice(0, 8)).filter(slug => published.has(slug));
  const pairings = await purchasedTogether(seeds);
  const available = catalogue.filter(item => item.available && item.slug !== data.basedOn &&
    !data.exclude.some(excluded => item.ingredients.some(part => Object.values(part).some(value => normalize(value).includes(normalize(excluded))))));
  const ranked = available.map(item => ({ item, score: searchScore(item, data.preference) * 5 + Math.min(pairings.get(item.slug) ?? 0, 3) + Number(history.has(item.slug)) + Number(item.featured) }))
    .sort((left, right) => right.score - left.score || left.item.slug.localeCompare(right.item.slug)).map(value => value.item);
  const model = shop.aiEnabled && ranked.length ? await runner.complete('recommendations',
    'Recommend up to three drinks or bowls for the preference. Return JSON with a slugs array, using only products from the provided catalogue, with matching options first.',
    { preference: redact(data.preference), language: data.language, catalogue: ranked.slice(0, 18).map(item => productView(item, data.language)) }, picked) : undefined;
  const valid = model ? pickVerified(available, model.slugs, 3) : [];
  const result = valid.length ? valid : ranked.slice(0, 3);
  return {
    source: valid.length ? 'ai' : 'fallback',
    products: result.map(item => ({
      ...productView(item, data.language),
      reason: searchScore(item, data.preference)
        ? data.language === 'si' ? 'ඔබේ රස තේරීමට ගැළපේ.' : 'Matches your flavour preferences.'
        : pairings.has(item.slug)
          ? data.language === 'si' ? 'මෙම මෙනු අයිතම එකට ඇණවුම් කර ඇත.' : 'Ordered alongside the selected or recently purchased items.'
          : data.language === 'si' ? 'දැනට ලබා ගත හැකි මෙනු තේරීමකි.' : 'An available option from the menu.',
    })),
  };
}
