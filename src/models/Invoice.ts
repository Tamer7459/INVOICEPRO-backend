import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface IInvoice extends Document {
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  customerId: mongoose.Types.ObjectId;
  status: "draft" | "sent" | "paid" | "overdue" | "canceled";
  items: IInvoiceItem[];
  subtotal: number;
  taxTotal: number;
  taxRate: number;
  salesTax: number;
  otherCharges: number;
  total: number;
  currency: "USD" | "EUR" | "DZD";
  dueDate: Date;
  sentAt?: Date;
  paidAt?: Date;
  notes?: string;
  thankYouMessage?: string;
  contactInfo?: string;
  paymentInfo?: string;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    status: { type: String, enum: ["draft", "sent", "paid", "overdue", "canceled"], default: "draft" },
    items: { type: [InvoiceItemSchema], required: true, validate: [(a: any[]) => a.length > 0, "At least one item"] },
    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    salesTax: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "EUR", "DZD"], default: "USD" },
    dueDate: { type: Date, required: true },
    sentAt: Date,
    paidAt: Date,
    notes: String,
    thankYouMessage: String,
    contactInfo: String,
    paymentInfo: String,
    pdfUrl: String,
  },
  { timestamps: true }
);

InvoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
