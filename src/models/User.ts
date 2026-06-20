import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  image?: string;
  googleId?: string;
  role: "user" | "admin";
  stripeCustomerId?: string;
  subscription: { planId: string; status: string; cancelAtPeriodEnd: boolean };
  invoiceCount: number;
  maxInvoices: number;
  currency: "USD" | "EUR" | "DZD";
  locale: "en" | "fr" | "ar";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    image: String,
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    stripeCustomerId: String,
    subscription: {
      planId: { type: String, default: "free" },
      status: { type: String, default: "active" },
      cancelAtPeriodEnd: { type: Boolean, default: false },
    },
    invoiceCount: { type: Number, default: 0 },
    maxInvoices: { type: Number, default: 5 },
    currency: { type: String, enum: ["USD", "EUR", "DZD"], default: "USD" },
    locale: { type: String, enum: ["en", "fr", "ar"], default: "en" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
