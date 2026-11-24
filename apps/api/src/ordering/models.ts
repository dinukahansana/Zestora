import { model, Schema, type Types } from 'mongoose';
import type { PaymentEnvironment } from '../payments/models.ts';
import type { CheckoutInput, LocalText } from './schemas.ts';

export const orderStates = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'] as const;
export const paymentStates = ['pending', 'paid', 'failed', 'refunded'] as const;
export type OrderState = (typeof orderStates)[number];
export type PaymentState = (typeof paymentStates)[number];
export type PaymentMethod = 'cash_pickup' | 'cash_delivery' | 'payhere';

export interface DeliveryZone {
  id: string;
  name: LocalText;
  fee: number;
}

export interface ShopPresentation {
  name: string;
  logo: string;
  phone: string;
  email: string;
  address: LocalText;
  hours: LocalText;
  map: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  defaultLanguage: 'en' | 'si';
  currency: 'LKR';
}

export interface ShopRecord {
  key: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryZones: DeliveryZone[];
  minimumOrder: number;
  presentation?: ShopPresentation;
  notificationsEnabled?: boolean;
  aiEnabled?: boolean;
}

const localText = new Schema({ en: { type: String, required: true }, si: { type: String, required: true } }, { _id: false });
const zoneSchema = new Schema<DeliveryZone>({
  id: { type: String, required: true },
  name: { type: localText, required: true },
  fee: { type: Number, min: 0, required: true },
}, { _id: false });

const shopSchema = new Schema<ShopRecord>({
  key: { type: String, required: true, unique: true },
  pickupEnabled: { type: Boolean, required: true },
  deliveryEnabled: { type: Boolean, required: true },
  deliveryZones: { type: [zoneSchema], default: [] },
  minimumOrder: { type: Number, min: 0, required: true },
  presentation: new Schema<ShopPresentation>({
    name: String, logo: String, phone: String, email: String,
    address: localText, hours: localText, map: String, whatsapp: String, instagram: String, facebook: String,
    defaultLanguage: { type: String, enum: ['en', 'si'] }, currency: { type: String, enum: ['LKR'] },
  }, { _id: false }),
  notificationsEnabled: { type: Boolean, default: true },
  aiEnabled: { type: Boolean, default: true },
}, { timestamps: true });

interface CouponRecord {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  minimumOrder: number;
  expiresAt?: Date;
  usageLimit?: number;
  uses: number;
}

const couponSchema = new Schema<CouponRecord>({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, min: 1, required: true },
  active: { type: Boolean, default: true },
  minimumOrder: { type: Number, min: 0, default: 0 },
  expiresAt: Date,
  usageLimit: { type: Number, min: 1 },
  uses: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

export interface PricedOption {
  id: string;
  name: LocalText;
  price: number;
}

export interface PricedLine {
  productSlug: string;
  name: LocalText;
  size: PricedOption;
  addOns: PricedOption[];
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

const pricedOption = new Schema<PricedOption>({ id: String, name: localText, price: Number }, { _id: false });
const lineSchema = new Schema<PricedLine>({
  productSlug: String, name: localText, size: pricedOption, addOns: [pricedOption], quantity: Number, unitPrice: Number, total: Number,
}, { _id: false });
const totalsSchema = new Schema<OrderTotals>({ subtotal: Number, discount: Number, deliveryFee: Number, total: Number }, { _id: false });

export interface OrderRecord {
  reference: string;
  checkoutKey: string;
  fingerprint: string;
  userId?: Types.ObjectId;
  guestHash?: string;
  customer: CheckoutInput['customer'];
  fulfillment: CheckoutInput['fulfillment'];
  notes: string;
  items: PricedLine[];
  totals: OrderTotals;
  coupon?: string;
  orderStatus: OrderState;
  paymentStatus: PaymentState;
  paymentMethod: PaymentMethod;
  paymentEnvironment?: PaymentEnvironment;
  billing?: CheckoutInput['billing'];
  language?: 'en' | 'si';
  feedbackEmail?: boolean;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const orderSchema = new Schema<OrderRecord>({
  reference: { type: String, required: true, unique: true },
  checkoutKey: { type: String, required: true, unique: true },
  fingerprint: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  guestHash: { type: String, select: false },
  customer: { type: new Schema({ name: String, email: String, phone: String }, { _id: false }), required: true },
  fulfillment: { type: new Schema({
    type: { type: String, enum: ['pickup', 'delivery'], required: true },
    zoneId: String, address: String, instructions: String, preferredAt: String,
  }, { _id: false }), required: true },
  notes: { type: String, default: '' },
  items: { type: [lineSchema], required: true },
  totals: { type: totalsSchema, required: true },
  coupon: String,
  orderStatus: { type: String, enum: orderStates, default: 'pending' },
  paymentStatus: { type: String, enum: paymentStates, default: 'pending' },
  paymentMethod: { type: String, enum: ['cash_pickup', 'cash_delivery', 'payhere'], required: true },
  paidAt: Date,
  paymentEnvironment: { type: String, enum: ['sandbox', 'live', 'simulator'] },
  billing: new Schema({ address: String, city: String }, { _id: false }),
  feedbackEmail: { type: Boolean, default: false },
  language: { type: String, enum: ['en', 'si'], default: 'en' },
}, { timestamps: true });

orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, paidAt: -1 });

export const Shop = model('Shop', shopSchema);
export const Coupon = model('Coupon', couponSchema);
export const Order = model('Order', orderSchema);
