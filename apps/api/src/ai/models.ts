import { model, Schema, type Types } from 'mongoose';

const usage = new Schema({
  feature: { type: String, required: true }, model: { type: String, required: true }, ok: { type: Boolean, required: true },
  durationMs: Number, inputTokens: Number, outputTokens: Number,
}, { timestamps: true });
usage.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

interface ReviewRecord {
  customerId: Types.ObjectId;
  orderReference: string;
  productSlug: string;
  rating: number;
  text: string;
  language: 'en' | 'si';
}

const review = new Schema<ReviewRecord>({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderReference: { type: String, required: true }, productSlug: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true }, text: { type: String, required: true },
  language: { type: String, enum: ['en', 'si'], required: true },
}, { timestamps: true });
review.index({ customerId: 1, orderReference: 1, productSlug: 1 }, { unique: true });

const reviewAnalysis = new Schema({
  reviewId: { type: Schema.Types.ObjectId, ref: 'Review', unique: true, required: true },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
  topics: [String], source: { type: String, enum: ['ai', 'rating'], required: true },
}, { timestamps: true });

const report = new Schema({
  period: { type: String, enum: ['day', 'week', 'month'], required: true },
  metrics: { type: Schema.Types.Mixed, required: true },
  summary: { type: String, required: true }, insights: [String], source: { type: String, enum: ['ai', 'fallback'] },
  language: { type: String, enum: ['en', 'si'], required: true },
  scheduleKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

const draft = new Schema({
  type: { type: String, enum: ['social', 'description', 'promotion', 'seasonal'], required: true },
  language: { type: String, enum: ['en', 'si'], required: true },
  tone: { type: String, enum: ['friendly', 'premium', 'playful'], required: true },
  content: { type: String, required: true }, source: { type: String, enum: ['ai', 'template'] },
  status: { type: String, enum: ['draft', 'approved'], default: 'draft' }, approvedAt: Date,
}, { timestamps: true });

export const AiUsage = model('AiUsage', usage);
export const Review = model('Review', review);
export const ReviewAnalysis = model('ReviewAnalysis', reviewAnalysis);
export const BusinessReport = model('BusinessReport', report);
export const MarketingDraft = model('MarketingDraft', draft);

const run = new Schema({
  requestId: { type: String, unique: true, required: true },
  state: { type: String, enum: ['running', 'done', 'failed'], required: true },
  result: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true, expires: 0 },
}, { minimize: false });
export const AiRun = model('AiRun', run);
