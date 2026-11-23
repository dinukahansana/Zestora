import type { Language } from '../i18n';

export type LocalText = Record<Language, string>;

export interface Category {
  slug: string;
  name: LocalText;
}

export interface Choice {
  id: string;
  name: LocalText;
  price: number;
}

export interface Product {
  slug: string;
  category: string;
  name: LocalText;
  description: LocalText;
  ingredients: LocalText[];
  image: string;
  featured: boolean;
  available: boolean;
  demo?: boolean;
  sizes: Choice[];
  addOns: Choice[];
}

const text = (en: string, si: string): LocalText => ({ en, si });

export const categories: Category[] = [
  { slug: 'juices', name: text('Fresh Juices', 'නැවුම් යුෂ') },
  { slug: 'smoothies', name: text('Smoothies', 'ස්මූති') },
  { slug: 'milkshakes', name: text('Milkshakes', 'මිල්ක්ෂේක්') },
  { slug: 'detox', name: text('Detox Drinks', 'ඩිටොක්ස් පාන') },
  { slug: 'bowls', name: text('Fruit Bowls', 'පලතුරු බඳුන්') },
  { slug: 'seasonal', name: text('Seasonal Specials', 'වාරයේ විශේෂ') },
];

const produce = {
  mango: text('Mango', 'අඹ'),
  strawberry: text('Strawberry', 'ස්ට්‍රෝබෙරි'),
  banana: text('Banana', 'කෙසෙල්'),
  orange: text('Orange', 'දොඩම්'),
  pineapple: text('Pineapple', 'අන්නාසි'),
  mint: text('Mint', 'මින්ට්'),
  lime: text('Lime', 'දෙහි'),
};

function drinkSizes(regular: number, large: number): Choice[] {
  return [
    { id: 'regular', name: text('Regular', 'සාමාන්‍ය'), price: regular },
    { id: 'large', name: text('Large', 'විශාල'), price: large },
  ];
}

const chia = { id: 'chia', name: text('Chia seeds', 'චියා බීජ'), price: 120 };
const coconut = { id: 'coconut', name: text('Toasted coconut', 'බැදපු පොල්'), price: 100 };
const fruit = { id: 'extra-fruit', name: text('Extra fruit', 'අමතර පලතුරු'), price: 150 };

export const products: Product[] = [
  {
    slug: 'golden-mango', category: 'juices', name: text('Golden Mango', 'රන්වන් අඹ'),
    description: text('Ripe mango with a squeeze of lime and a little fresh mint.', 'ඉදුණු අඹ සමඟ දෙහි යුෂ සහ නැවුම් මින්ට් ස්වල්පයක්.'),
    ingredients: [produce.mango, produce.lime, produce.mint],
    image: '/images/mango.webp', featured: true, available: true,
    sizes: drinkSizes(690, 850), addOns: [chia, fruit],
  },
  {
    slug: 'berry-bliss', category: 'smoothies', name: text('Berry Bliss', 'බෙරි බ්ලිස්'),
    description: text('Strawberries and banana blended with creamy yoghurt.', 'ක්‍රීම් රස යෝගට් සමඟ මිශ්‍ර කළ ස්ට්‍රෝබෙරි සහ කෙසෙල්.'),
    ingredients: [produce.strawberry, produce.banana, text('Yoghurt', 'යෝගට්')],
    image: '/images/berry.webp', featured: true, available: true,
    sizes: drinkSizes(790, 950), addOns: [chia, fruit],
  },
  {
    slug: 'green-glow', category: 'detox', name: text('Green Glow', 'ග්‍රීන් ග්ලෝ'),
    description: text('Cool cucumber, green apple, lime, and mint.', 'සිසිල් පිපිඤ්ඤා, කොළ ඇපල්, දෙහි සහ මින්ට්.'),
    ingredients: [text('Cucumber', 'පිපිඤ්ඤා'), text('Green apple', 'කොළ ඇපල්'), produce.lime, produce.mint],
    image: '/images/green.webp', featured: true, available: true,
    sizes: drinkSizes(650, 790), addOns: [chia],
  },
  {
    slug: 'cocoa-cloud', category: 'milkshakes', name: text('Cocoa Cloud', 'කොකෝ ක්ලවුඩ්'),
    description: text('Cocoa and banana in a smooth vanilla milkshake.', 'වැනිලා මිල්ක්ෂේක් එකක කොකෝවා සහ කෙසෙල් රස.'),
    ingredients: [text('Cocoa', 'කොකෝවා'), produce.banana, text('Milk', 'කිරි'), text('Vanilla ice cream', 'වැනිලා අයිස් ක්‍රීම්')],
    image: '/images/cocoa.webp', featured: false, available: true,
    sizes: drinkSizes(850, 990), addOns: [coconut],
  },
  {
    slug: 'island-fruit-bowl', category: 'bowls', name: text('Island Fruit Bowl', 'දිවයිනේ පලතුරු බඳුන'),
    description: text('Pineapple, mango, papaya, and banana with toasted coconut.', 'බැදපු පොල් සමඟ අන්නාසි, අඹ, පැපොල් සහ කෙසෙල්.'),
    ingredients: [produce.pineapple, produce.mango, text('Papaya', 'පැපොල්'), produce.banana, coconut.name],
    image: '/images/bowl.webp', featured: false, available: true,
    sizes: [{ id: 'bowl', name: text('Bowl', 'බඳුන'), price: 980 }], addOns: [chia, fruit],
  },
  {
    slug: 'passion-cooler', category: 'seasonal', name: text('Passionfruit Cooler', 'පැෂන් ෆෘට් සිසිල් පානය'),
    description: text('Tangy passionfruit and fresh orange over ice.', 'අයිස් සමඟ ඇඹුල් පැෂන් ෆෘට් සහ නැවුම් දොඩම් යුෂ.'),
    ingredients: [text('Passionfruit', 'පැෂන් ෆෘට්'), produce.orange],
    image: '/images/passion.webp', featured: false, available: false,
    sizes: drinkSizes(740, 890), addOns: [],
  },
];

export function startingPrice(product: Product) {
  return Math.min(...product.sizes.map(size => size.price));
}

export function formatPrice(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'si' ? 'si-LK' : 'en-LK', {
    style: 'currency',
    currency: 'LKR',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}
