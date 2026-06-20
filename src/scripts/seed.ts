import mongoose from "mongoose";
import { connectDB } from "../db/connection";
import { User } from "../models/User";
import { Customer } from "../models/Customer";
import { Invoice } from "../models/Invoice";
import { CompanySettings } from "../models/CompanySettings";

async function seed() {
  await connectDB();
  console.log("Seeding...");

  const admin = await User.findOneAndUpdate(
    { email: "admin@invoicepro.com" },
    { name: "Admin User", email: "admin@invoicepro.com", role: "admin", maxInvoices: -1 },
    { upsert: true, new: true }
  );
  console.log("Admin:", admin.email);

  const customers = await Customer.insertMany([
    { userId: admin._id, name: "Acme Corp", email: "contact@acme.com", city: "New York", country: "USA" },
    { userId: admin._id, name: "TechStart Inc", email: "info@techstart.io", city: "San Francisco", country: "USA" },
    { userId: admin._id, name: "Global Services", email: "hello@globalservices.com", city: "London", country: "UK" },
  ]);

  await CompanySettings.findOneAndUpdate({ userId: admin._id }, { companyName: "Invoice Pro Inc" }, { upsert: true });

  const invoices = [];
  for (let i = 0; i < 5; i++) {
    const items = [
      { description: "Web Development", quantity: 1, unitPrice: 1500, taxRate: 20, total: 1800 },
      { description: "Hosting (Monthly)", quantity: 12, unitPrice: 29.99, taxRate: 20, total: 431.86 },
    ];
    const subtotal = items.reduce((s, x) => s + x.quantity * x.unitPrice, 0);
    const taxTotal = items.reduce((s, x) => s + x.total - x.quantity * x.unitPrice, 0);
    invoices.push({
      userId: admin._id,
      invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}`,
      customerId: customers[i % 3]._id,
      status: ["draft", "sent", "paid", "overdue", "sent"][i],
      items, subtotal, taxTotal, total: subtotal + taxTotal,
      currency: "USD",
      dueDate: new Date(Date.now() + (i - 2) * 7 * 86400000),
      notes: "Thank you!",
    });
  }
  await Invoice.insertMany(invoices);
  await User.findByIdAndUpdate(admin._id, { invoiceCount: invoices.length });

  console.log(`Done: ${invoices.length} invoices, ${customers.length} customers`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
