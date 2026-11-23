import mongoose from 'mongoose';
import { Product, Category } from './catalogue/models.ts';
import { Session, User } from './auth/models.ts';

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000, bufferCommands: false, autoCreate: false, autoIndex: false,
  });
  await Promise.all([Product, Category, User, Session].map(async model => {
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
