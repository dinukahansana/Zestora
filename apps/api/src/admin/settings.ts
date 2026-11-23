import { Router } from 'express';
import { z } from 'zod';
import { imageSchema, slugSchema } from '../catalogue/schemas.ts';
import { Shop, type ShopPresentation } from '../ordering/models.ts';

export const nameSchema = z.strictObject({ en: z.string().trim().min(1).max(120), si: z.string().trim().min(1).max(120) });
const detail = z.strictObject({ en: z.string().trim().max(350), si: z.string().trim().max(350) });
const publicLink = z.url({ protocol: /^https$/ }).max(500).or(z.literal(''));

export const emptyPresentation: ShopPresentation = {
  name: 'Zestora', logo: '', phone: '', email: '', address: { en: '', si: '' }, hours: { en: '', si: '' },
  map: '', whatsapp: '', instagram: '', facebook: '', defaultLanguage: 'en', currency: 'LKR',
};

const presentation = z.strictObject({
  name: z.string().trim().min(2).max(80),
  logo: imageSchema.or(z.literal('')),
  phone: z.string().trim().regex(/^\+?[\d ()-]*$/).max(25),
  email: z.email().or(z.literal('')),
  address: detail,
  hours: detail,
  map: publicLink, whatsapp: publicLink, instagram: publicLink, facebook: publicLink,
  defaultLanguage: z.enum(['en', 'si']),
  currency: z.literal('LKR'),
});

const zone = z.strictObject({ id: slugSchema, name: nameSchema, fee: z.number().int().min(0).max(100000) });
export const shopInput = z.strictObject({
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  minimumOrder: z.number().int().min(0).max(1000000),
  deliveryZones: z.array(zone).max(30).refine(zones => new Set(zones.map(item => item.id)).size === zones.length),
  presentation,
  notificationsEnabled: z.boolean(),
  aiEnabled: z.boolean(),
}).refine(shop => !shop.deliveryEnabled || shop.deliveryZones.length > 0, 'Delivery requires a zone.');

export async function currentShop() {
  const shop = await Shop.findOne({ key: 'default' }).lean();
  return {
    pickupEnabled: shop?.pickupEnabled ?? true,
    deliveryEnabled: shop?.deliveryEnabled ?? false,
    minimumOrder: shop?.minimumOrder ?? 0,
    deliveryZones: shop?.deliveryZones ?? [],
    presentation: { ...emptyPresentation, ...shop?.presentation },
    notificationsEnabled: shop?.notificationsEnabled ?? true,
    aiEnabled: shop?.aiEnabled ?? true,
  };
}

export const storefrontSettingsRouter = Router();
storefrontSettingsRouter.get('/shop/storefront', async (_request, response) => {
  response.json((await currentShop()).presentation);
});
