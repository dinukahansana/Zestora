import { model, Schema, type Types } from 'mongoose';

interface StockRecord {
  slug: string;
  name: { en: string; si: string };
  unit: string;
  onHand: number;
  threshold: number;
}

const stockSchema = new Schema<StockRecord>({
  slug: { type: String, required: true, unique: true },
  name: { en: { type: String, required: true }, si: { type: String, required: true } },
  unit: { type: String, required: true },
  onHand: { type: Number, min: 0, required: true },
  threshold: { type: Number, min: 0, required: true },
}, { timestamps: true });

interface AuditRecord {
  actorId: Types.ObjectId;
  action: string;
  entity: string;
  reference: string;
}

const auditSchema = new Schema<AuditRecord>({
  actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  reference: { type: String, required: true },
}, { timestamps: true });

auditSchema.index({ createdAt: -1 });
export const Stock = model('Stock', stockSchema);
export const AuditLog = model('AuditLog', auditSchema);
