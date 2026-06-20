import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  status: "active" | "inactive" | "archived";
  totalInvoices: number;
  totalRevenue: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: String,
    address: String,
    city: String,
    country: String,
    taxNumber: String,
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    totalInvoices: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CustomerSchema.index({ userId: 1, email: 1 }, { unique: true });
CustomerSchema.index({ userId: 1, name: 1 });

export const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema);
