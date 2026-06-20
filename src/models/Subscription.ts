import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  planId: string;
  features: string[];
  paidPlans: string[];
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    stripeSubscriptionId: { type: String, unique: true, sparse: true },
    stripePriceId: String,
    status: { type: String, enum: ["active", "canceled", "past_due", "trialing", "incomplete"], default: "trialing" },
    planId: { type: String, default: "free" },
    features: [{ type: String }],
    paidPlans: [{ type: String }],
    cancelAtPeriodEnd: { type: Boolean, default: false },
    currentPeriodEnd: Date,
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
