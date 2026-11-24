import { model, Schema, type ClientSession } from 'mongoose';
import { Stock } from './admin/models.ts';
import type { Email, SendEmail } from './mail.ts';
import { Shop, type OrderRecord } from './ordering/models.ts';

const notificationSchema = new Schema({
  key: { type: String, unique: true, required: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'failed'], default: 'queued' },
}, { timestamps: true });
export const Notification = model('Notification', notificationSchema);

const events = {
  created: ['Your order was received', 'ඔබේ ඇණවුම ලැබුණි'],
  confirmed: ['Your order was confirmed', 'ඔබේ ඇණවුම තහවුරු කරන ලදී'],
  preparing: ['Your order is being prepared', 'ඔබේ ඇණවුම සකස් කරමින් පවතී'],
  ready_for_pickup: ['Your order is ready for pickup', 'ඔබේ ඇණවුම රැගෙන යාමට සූදානම්'],
  out_for_delivery: ['Your order is out for delivery', 'ඔබේ ඇණවුම බෙදාහැරීමට පිටත් වී ඇත'],
  completed: ['Your order is complete', 'ඔබේ ඇණවුම සම්පූර්ණයි'],
  cancelled: ['Your order was cancelled', 'ඔබේ ඇණවුම අවලංගු කරන ලදී'],
  paid: ['Your payment was recorded', 'ඔබේ ගෙවීම සටහන් කරන ලදී'],
  failed: ['Your online payment was unsuccessful', 'ඔබේ මාර්ගගත ගෙවීම අසාර්ථක විය'],
  refunded: ['Your online payment was reversed', 'ඔබේ මාර්ගගත ගෙවීම ආපසු හරවා ඇත'],
} satisfies Record<string, [string, string]>;
type Notice = keyof typeof events;

export async function prepareNotice(order: OrderRecord, event: Notice, session: ClientSession, sendEmail?: SendEmail) {
  if (!sendEmail || (order.paymentEnvironment && order.paymentEnvironment !== 'live')) return;
  const shop = await Shop.findOne({ key: 'default' }).select('notificationsEnabled presentation.name').session(session).lean();
  if (shop?.notificationsEnabled === false) return;
  const key = `${order.reference}:${event}`;
  const language = order.language === 'si' ? 1 : 0;
  const subject = events[event][language];
  const text = `${subject}.\n${language === 1 ? 'ඇණවුම් යොමුව' : 'Order reference'}: ${order.reference}\n${shop?.presentation?.name ?? 'Zestora'}`;
  await Notification.updateOne({ key }, { $setOnInsert: { key, to: order.customer.email, subject, text, status: 'queued' } }, { session, upsert: true, timestamps: false });
  return key;
}

export async function deliverNotice(key?: string, sendEmail?: SendEmail) {
  if (!key || !sendEmail) return;
  try {
    const job = await Notification.findOneAndUpdate({ key, status: 'queued' }, { $set: { status: 'sending' } }, { returnDocument: 'after' }).lean();
    if (!job) return;
    const mail: Email = { to: job.to, subject: job.subject, text: job.text };
    let status = 'sent';
    try { await sendEmail(mail); } catch { status = 'failed'; }
    await Notification.updateOne({ key, status: 'sending' }, { $set: { status } });
  } catch {
    console.error('Order notification dispatch failed.');
  }
}

export async function deliverStockNotice(eventId: string, slug: string, sendEmail?: SendEmail) {
  if (!sendEmail) return;
  const shop = await Shop.findOne({ key: 'default' }).lean();
  if (!shop?.presentation?.email || shop.notificationsEnabled === false) return;
  const item = await Stock.findOne({ slug }).lean();
  if (!item || item.onHand > item.threshold) return;
  const key = `stock:${eventId}`;
  const si = shop.presentation.defaultLanguage === 'si';
  const subject = si ? 'අඩු තොග දැනුම්දීම' : 'Low stock alert';
  const text = `${item.name[si ? 'si' : 'en']}: ${item.onHand} ${item.unit} (${si ? 'අවම සීමාව' : 'threshold'} ${item.threshold})`;
  await Notification.updateOne({ key }, { $setOnInsert: { key, subject, text, to: shop.presentation.email, status: 'queued' } }, { upsert: true, timestamps: false });
  await deliverNotice(key, sendEmail);
}
