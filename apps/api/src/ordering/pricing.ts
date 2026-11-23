import type { ClientSession } from 'mongoose';
import { Category, Product } from '../catalogue/models.ts';
import { HttpError } from '../http.ts';
import { Coupon, Shop, type PricedLine, type ShopRecord } from './models.ts';
import type { QuoteInput } from './schemas.ts';

const defaultShop: ShopRecord = { key: 'default', pickupEnabled: true, deliveryEnabled: false, deliveryZones: [], minimumOrder: 0 };

export async function checkoutSettings(session: ClientSession | null = null) {
  const shop = await Shop.findOne({ key: 'default' }).session(session).lean();
  const { pickupEnabled, deliveryEnabled, deliveryZones, minimumOrder } = shop ?? defaultShop;
  return { pickupEnabled, deliveryEnabled, deliveryZones, minimumOrder };
}

export async function priceCart(input: QuoteInput, session: ClientSession | null = null) {
  const shop = await checkoutSettings(session);
  const delivery = input.fulfillment.type === 'delivery' ? input.fulfillment : undefined;
  const zone = delivery ? shop.deliveryZones.find(item => item.id === delivery.zoneId) : undefined;
  if (delivery ? !shop.deliveryEnabled || !zone : !shop.pickupEnabled) {
    throw new HttpError(400, 'FULFILLMENT_UNAVAILABLE', 'Choose an available pickup or delivery option.');
  }

  const slugs = [...new Set(input.items.map(line => line.productSlug))];
  const products = await Product.find({ slug: { $in: slugs }, published: true, available: true }).session(session).lean();
  const categories = await Category.find({ slug: { $in: products.map(product => product.category) }, published: true }).session(session).lean();
  const enabled = new Set(categories.map(category => category.slug));
  const bySlug = new Map(products.map(product => [product.slug, product]));
  const variants = new Set<string>();
  const items: PricedLine[] = input.items.map(line => {
    const product = bySlug.get(line.productSlug);
    if (!product || !enabled.has(product.category)) throw new HttpError(409, 'ITEM_UNAVAILABLE', 'A requested item is no longer available.');
    const size = product.sizes.find(option => option.id === line.sizeId);
    const addOns = product.addOns.filter(option => line.addOnIds.includes(option.id));
    if (!size || addOns.length !== line.addOnIds.length) throw new HttpError(400, 'INVALID_OPTIONS', 'A selected size or add-on is unavailable.');
    const variant = [line.productSlug, line.sizeId, ...[...line.addOnIds].sort()].join(':');
    if (variants.has(variant)) throw new HttpError(400, 'DUPLICATE_CART_LINE', 'Combine matching items into one cart line.');
    variants.add(variant);
    const quantity = line.quantity;
    const unitPrice = size.price + addOns.reduce((total, option) => total + option.price, 0);
    return { productSlug: product.slug, name: product.name, size, addOns, quantity, unitPrice, total: unitPrice * quantity };
  });

  const subtotal = items.reduce((total, item) => total + item.total, 0);
  if (subtotal < shop.minimumOrder) throw new HttpError(400, 'MINIMUM_ORDER', 'The cart is below the minimum order amount.');
  let discount = 0;
  let couponRecord = null;
  if (input.coupon) {
    couponRecord = await Coupon.findOne({ code: input.coupon, active: true }).session(session).lean();
    if (!couponRecord || subtotal < couponRecord.minimumOrder || (couponRecord.expiresAt && couponRecord.expiresAt <= new Date()) ||
        (couponRecord.usageLimit !== undefined && couponRecord.uses >= couponRecord.usageLimit)) {
      throw new HttpError(400, 'INVALID_COUPON', 'This coupon cannot be applied.');
    }
    const amount = couponRecord.type === 'percent' ? Math.floor(subtotal * couponRecord.value / 100) : couponRecord.value;
    discount = Math.min(subtotal, amount);
  }
  const deliveryFee = zone?.fee ?? 0;
  return { items, totals: { subtotal, discount, deliveryFee, total: subtotal - discount + deliveryFee }, couponRecord };
}
