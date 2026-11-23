import { model, Schema, type Types } from 'mongoose';

export const roles = ['customer', 'admin'] as const;
export type Role = typeof roles[number];

interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  addresses?: { _id: Types.ObjectId; label: string; address: string }[];
  resetHash?: string;
  resetExpiry?: Date;
}

const userSchema = new Schema<UserRecord>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: roles, default: 'customer', required: true },
  addresses: [{ label: { type: String, required: true }, address: { type: String, required: true } }],
  resetHash: { type: String, select: false, sparse: true, index: true },
  resetExpiry: { type: Date, select: false },
}, { timestamps: true });

interface SessionRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

export const User = model('User', userSchema);
export const Session = model('Session', sessionSchema);
