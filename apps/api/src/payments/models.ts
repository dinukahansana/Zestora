import { model, Schema } from 'mongoose';
import { paymentStates, type PaymentState } from '../ordering/models.ts';

export const paymentEnvironments = ['sandbox', 'live', 'simulator'] as const;
export type PaymentEnvironment = typeof paymentEnvironments[number];

interface PaymentRecord {
  orderReference: string;
  environment: PaymentEnvironment;
  status: PaymentState;
  amount: number;
  currency: 'LKR';
  providerId?: string;
  lastStatus?: string;
  paidAt?: Date;
}

const paymentSchema = new Schema<PaymentRecord>({
  orderReference: { type: String, unique: true, required: true },
  environment: { type: String, enum: paymentEnvironments, required: true },
  status: { type: String, enum: paymentStates, default: 'pending' },
  amount: { type: Number, min: 1, required: true },
  currency: { type: String, enum: ['LKR'], default: 'LKR' },
  providerId: String,
  lastStatus: String,
  paidAt: Date,
}, { timestamps: true });

export const Payment = model('Payment', paymentSchema);
