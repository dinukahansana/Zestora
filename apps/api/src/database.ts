import mongoose from 'mongoose';
import { AuditLog, Stock } from './admin/models.ts';
import { Product, Category } from './catalogue/models.ts';
import { Session, User } from './auth/models.ts';
import { Notification } from './notifications.ts';
import { Payment } from './payments/models.ts';
import { Coupon, Order, Shop } from './ordering/models.ts';

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000, bufferCommands: false, autoCreate: false, autoIndex: false,
  });
  await Promise.all([Product, Category, User, Session, Coupon, Order, Shop, AuditLog, Stock, Payment, Notification].map(async model => {
    await model.createCollection();
    await model.createIndexes();
  }));
}

export function databaseReady() {
  return mongoose.connection.readyState === 1;
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}
