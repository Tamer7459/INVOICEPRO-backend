import mongoose, { Schema, Document } from "mongoose";

export interface ICompanySettings extends Document {
  userId: mongoose.Types.ObjectId;
  companyName: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  thankYouMessage?: string;
  defaultCurrency: "USD" | "EUR" | "DZD";
  invoicePrefix: string;
  nextInvoiceNumber: number;
}

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyName: { type: String, default: "My Company" },
    logo: String,
    address: String,
    phone: String,
    email: String,
    taxNumber: String,
    thankYouMessage: { type: String, default: "Thank you for your business!" },
    defaultCurrency: { type: String, enum: ["USD", "EUR", "DZD"], default: "USD" },
    invoicePrefix: { type: String, default: "INV" },
    nextInvoiceNumber: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const CompanySettings = mongoose.model<ICompanySettings>("CompanySettings", CompanySettingsSchema);
