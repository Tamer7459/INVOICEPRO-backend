import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth";
import { Invoice } from "../models/Invoice";
import { Customer } from "../models/Customer";
import { CompanySettings } from "../models/CompanySettings";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, NotFoundError } from "../utils/errors";
import { config } from "../config";
import PDFDocument from "pdfkit";

const router = Router();
router.use(authenticate);

router.get("/preview/:template", asyncHandler(async (req: Request, res: Response) => {
  const settings = await CompanySettings.findOne({ userId: req.user!.userId });
  const template = req.params.template || "modern";

  const themes: Record<string, { primary: string; headerBg: string; tableBg: string; accent: string }> = {
    modern:      { primary: "#2563eb", headerBg: "#2563eb", tableBg: "#eff6ff", accent: "#1d4ed8" },
    classic:     { primary: "#374151", headerBg: "#1f2937", tableBg: "#f3f4f6", accent: "#111827" },
    minimal:     { primary: "#64748b", headerBg: "#475569", tableBg: "#f8fafc", accent: "#334155" },
    bold:        { primary: "#ea580c", headerBg: "#ea580c", tableBg: "#fff7ed", accent: "#c2410c" },
    professional:{ primary: "#059669", headerBg: "#059669", tableBg: "#ecfdf5", accent: "#047857" },
    creative:    { primary: "#9333ea", headerBg: "#9333ea", tableBg: "#faf5ff", accent: "#7e22ce" },
  };
  const th = themes[template] || themes.modern;
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=preview-${template}.pdf`);
  doc.pipe(res);
  const pageW = 595.28;
  const cur = "$";

  // BLACK HEADER
  doc.rect(0, 0, pageW, 90).fill(th.headerBg);
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text(settings?.companyName || "Your Company", 50, 20, { width: 300 });
  doc.fontSize(9).font("Helvetica").text(settings?.address || "123 Business St", 50, 42, { width: 300 });
  if (settings?.phone) doc.text(`Phone: ${settings.phone}`, 50, 55, { width: 300 });
  doc.fontSize(28).font("Helvetica-Bold").text("INVOICE", pageW - 200, 25, { width: 150, align: "right" });

  // COMPANY + DATE
  let y = 110;
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text("Company Address", 50, y);
  y += 18;
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(settings?.companyName || "Your Company", 50, y); y += 14;
  if (settings?.phone) { doc.text(`Phone: ${settings.phone}`, 50, y); y += 14; }

  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - 200, 110, { width: 150, align: "right" });
  doc.text("Invoice #: INV-2026-0001", pageW - 200, 126, { width: 150, align: "right" });
  doc.text("Customer ID: CUST-01", pageW - 200, 142, { width: 150, align: "right" });

  // BILL TO
  y = 170;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Bill To", 50, y);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Prepared by: Admin", pageW - 200, y, { width: 150, align: "right" });
  y += 18;
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text("Contact Person: John Doe", 50, y); y += 14;
  doc.text("Company Name: Acme Corp", 50, y); y += 14;
  doc.text("Location: New York, USA", 50, y); y += 14;
  doc.text("Phone: +1 234 567 890", 50, y); y += 14;

  y += 10;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Invoice Due Date: " + new Date(Date.now() + 30 * 86400000).toLocaleDateString(), 50, y);

  // TABLE
  y += 25;
  const colX = [50, 110, 310, 400, 470];
  doc.rect(50, y, 495, 22).fill(th.headerBg);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  doc.text("Quantity", colX[0] + 5, y + 7, { width: 60 });
  doc.text("Description", colX[1] + 5, y + 7, { width: 200 });
  doc.text("Unit Price", colX[2], y + 7, { width: 90, align: "right" });
  doc.text("Taxable?", colX[3], y + 7, { width: 70, align: "right" });
  doc.text("Amount", colX[4], y + 7, { width: 85, align: "right" });

  const items = [{ d: "Web Development Services", q: 1, p: 1500, t: 10 }, { d: "UI/UX Design", q: 1, p: 800, t: 10 }, { d: "Monthly Hosting", q: 3, p: 50, t: 5 }];
  y += 22;
  doc.font("Helvetica").fontSize(8);
  items.forEach((it, idx) => {
    if (y > 720) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) doc.rect(50, y, 495, 20).fill(th.tableBg);
    const total = it.q * it.p * (1 + it.t / 100);
    doc.fillColor("#333");
    doc.text(String(it.q), colX[0] + 5, y + 5, { width: 60 });
    doc.text(it.d, colX[1] + 5, y + 5, { width: 200 });
    doc.text(`${cur}${it.p.toFixed(2)}`, colX[2], y + 5, { width: 90, align: "right" });
    doc.text(it.t > 0 ? "Yes" : "No", colX[3], y + 5, { width: 70, align: "right" });
    doc.text(`${cur}${total.toFixed(2)}`, colX[4], y + 5, { width: 85, align: "right" });
    y += 20;
  });

  const subtotal = items.reduce((s, i) => s + i.q * i.p, 0);
  const taxTotal = items.reduce((s, i) => s + i.q * i.p * (i.t / 100), 0);

  y += 15;
  const totalsX = 360;
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  doc.text("Subtotal", totalsX, y, { width: 100 }); doc.text(`${cur}${subtotal.toFixed(2)}`, 490, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Tax Rate", totalsX, y, { width: 100 }); doc.text("10%", 490, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Sales Tax", totalsX, y, { width: 100 }); doc.text(`${cur}${taxTotal.toFixed(2)}`, 490, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Other", totalsX, y, { width: 100 }); doc.text(`${cur}0.00`, 490, y, { width: 55, align: "right" });

  y += 25;
  doc.rect(totalsX, y - 3, 185, 28).fill(th.headerBg);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff");
  doc.text("TOTAL", totalsX + 8, y + 5, { width: 80 });
  doc.text(`${cur}${(subtotal + taxTotal).toFixed(2)}`, 490, y + 5, { width: 55, align: "right" });

  y += 45;
  doc.moveTo(50, y).lineTo(pageW - 50, y).stroke("#ccc");
  y += 12;
  doc.font("Helvetica").fontSize(8).fillColor("#555").text("If you have any questions concerning this Invoice, please contact us.", 50, y);
  y += 14;
  doc.text("All dues are payable through Cash or Bank Transfer.", 50, y);
  y += 20;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Thank you for your business!", 50, y, { width: 495 });

  doc.end();
}));

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "10", status, search, customer } = req.query;
  const query: any = { userId: req.user!.userId };
  if (status === "overdue") {
    query.dueDate = { $lt: new Date() };
    query.status = { $nin: ["paid", "canceled"] };
  } else if (status) {
    query.status = status;
  }
  if (search) query.invoiceNumber = { $regex: search, $options: "i" };
  if (customer) query.customerId = customer;

  const p = parseInt(page as string), l = parseInt(limit as string);
  const [data, total] = await Promise.all([
    Invoice.find(query).populate("customerId", "name email phone").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    Invoice.countDocuments(query),
  ]);
  res.json({ success: true, data, meta: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
}));

router.get("/:id/pdf", asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user!.userId })
    .populate("customerId", "name email phone address city country");
  if (!invoice) throw new NotFoundError("Invoice");

  const settings = await CompanySettings.findOne({ userId: req.user!.userId });
  const user = await User.findById(req.user!.userId);
  const template = (req.query.template as string) || "modern";

  const themes: Record<string, { primary: string; headerBg: string; tableBg: string; accent: string }> = {
    modern:      { primary: "#2563eb", headerBg: "#2563eb", tableBg: "#eff6ff", accent: "#1d4ed8" },
    classic:     { primary: "#374151", headerBg: "#1f2937", tableBg: "#f3f4f6", accent: "#111827" },
    minimal:     { primary: "#64748b", headerBg: "#475569", tableBg: "#f8fafc", accent: "#334155" },
    bold:        { primary: "#ea580c", headerBg: "#ea580c", tableBg: "#fff7ed", accent: "#c2410c" },
    professional:{ primary: "#059669", headerBg: "#059669", tableBg: "#ecfdf5", accent: "#047857" },
    creative:    { primary: "#9333ea", headerBg: "#9333ea", tableBg: "#faf5ff", accent: "#7e22ce" },
  };
  const th = themes[template] || themes.modern;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  const pageW = 595.28;
  const cur = invoice.currency || "USD";
  const sym = cur === "EUR" ? "€" : cur === "DZD" ? "DZD" : "$";
  const cust = invoice.customerId as any;

  // ── BLACK HEADER BAR ──
  doc.rect(0, 0, pageW, 90).fill(th.headerBg);
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text(settings?.companyName || "Company", 50, 20, { width: 300 });
  doc.fontSize(9).font("Helvetica").text(settings?.address || "", 50, 42, { width: 300 });
  if (settings?.phone) doc.text(`Phone: ${settings.phone}`, 50, 55, { width: 300 });
  doc.fontSize(28).font("Helvetica-Bold").text("INVOICE", pageW - 200, 25, { width: 150, align: "right" });

  // ── COMPANY ADDRESS + DATE/INVOICE/CUSTOMER ──
  let y = 110;
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text("Company Address", 50, y);
  y += 18;
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(settings?.companyName || "", 50, y); y += 14;
  if (settings?.phone) { doc.text(`Phone: ${settings.phone}`, 50, y); y += 14; }
  if (settings?.taxNumber) { doc.text(`Tax: ${settings.taxNumber}`, 50, y); y += 14; }

  // Right side: Date, Invoice #, Customer ID
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : "-"}`, pageW - 200, 110, { width: 150, align: "right" });
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageW - 200, 126, { width: 150, align: "right" });
  doc.text(`Customer ID: ${cust?._id ? cust._id.toString().slice(-6).toUpperCase() : "-"}`, pageW - 200, 142, { width: 150, align: "right" });

  // ── BILL TO ──
  y = 170;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Bill To", 50, y);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text(`Prepared by: ${user?.name || "-"}`, pageW - 200, y, { width: 150, align: "right" });
  y += 18;
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  if (cust?.name) { doc.text(`Contact Person: ${cust.name}`, 50, y); y += 14; }
  doc.text(`Company Name: ${cust?.name || "-"}`, 50, y); y += 14;
  const loc = [cust?.address, cust?.city, cust?.country].filter(Boolean).join(", ");
  if (loc) { doc.text(`Location: ${loc}`, 50, y); y += 14; }
  if (cust?.phone) { doc.text(`Phone: ${cust.phone}`, 50, y); y += 14; }

  // ── DUE DATE ──
  y += 10;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text(`Invoice Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}`, 50, y);

  // ── ITEMS TABLE ──
  y += 25;
  const colW = [60, 200, 90, 70, 85];
  const colX = [50, 110, 310, 400, 470];

  // Table header
  doc.rect(50, y, 495, 22).fill(th.headerBg);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  doc.text("Quantity", colX[0] + 5, y + 7, { width: colW[0] });
  doc.text("Description", colX[1] + 5, y + 7, { width: colW[1] });
  doc.text("Unit Price", colX[2], y + 7, { width: colW[2], align: "right" });
  doc.text("Taxable?", colX[3], y + 7, { width: colW[3], align: "right" });
  doc.text("Amount", colX[4], y + 7, { width: colW[4], align: "right" });

  y += 22;
  doc.font("Helvetica").fontSize(8);
  (invoice.items || []).forEach((item: any, idx: number) => {
    if (y > 720) { doc.addPage(); y = 50; }
    const isEven = idx % 2 === 0;
    if (isEven) doc.rect(50, y, 495, 20).fill(th.tableBg);
    const taxable = (item.tax || item.taxRate || 0) > 0;
    const amount = item.quantity * item.unitPrice * (1 + (item.tax || item.taxRate || 0) / 100);
    doc.fillColor("#333");
    doc.text(String(item.quantity), colX[0] + 5, y + 5, { width: colW[0] });
    doc.text(item.description, colX[1] + 5, y + 5, { width: colW[1] });
    doc.text(`${sym}${item.unitPrice.toFixed(2)}`, colX[2], y + 5, { width: colW[2], align: "right" });
    doc.text(taxable ? "Yes" : "No", colX[3], y + 5, { width: colW[3], align: "right" });
    doc.text(`${sym}${amount.toFixed(2)}`, colX[4], y + 5, { width: colW[4], align: "right" });
    y += 20;
  });

  // ── TOTALS ──
  y += 15;
  const totalsX = 360;
  const totalsValX = 490;
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  doc.text("Subtotal", totalsX, y, { width: 100 }); doc.text(`${sym}${invoice.subtotal.toFixed(2)}`, totalsValX, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Tax Rate", totalsX, y, { width: 100 }); doc.text(`${invoice.taxRate || 0}%`, totalsValX, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Sales Tax", totalsX, y, { width: 100 }); doc.text(`${sym}${(invoice.salesTax || 0).toFixed(2)}`, totalsValX, y, { width: 55, align: "right" });
  y += 20;
  doc.text("Other", totalsX, y, { width: 100 }); doc.text(`${sym}${(invoice.otherCharges || 0).toFixed(2)}`, totalsValX, y, { width: 55, align: "right" });

  // TOTAL row with black background
  y += 25;
  doc.rect(totalsX, y - 3, 185, 28).fill(th.headerBg);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff");
  doc.text("TOTAL", totalsX + 8, y + 5, { width: 80 });
  doc.text(`${sym}${invoice.total.toFixed(2)}`, totalsValX, y + 5, { width: 55, align: "right" });

  // ── FOOTER ──
  y += 40;
  doc.moveTo(50, y).lineTo(pageW - 50, y).stroke("#ccc");
  y += 12;

  if (invoice.contactInfo) {
    doc.font("Helvetica").fontSize(8).fillColor("#555").text(invoice.contactInfo, 50, y, { width: 495 });
    y += 14;
  }
  if (invoice.paymentInfo) {
    doc.font("Helvetica").fontSize(8).fillColor("#555").text(invoice.paymentInfo, 50, y, { width: 495 });
    y += 14;
  }

  if (invoice.thankYouMessage) {
    y += 10;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text(invoice.thankYouMessage, 50, y, { width: 495 });
  }

  doc.end();
}));

router.post("/:id/send", asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user!.userId })
    .populate("customerId", "name email phone address city country");
  if (!invoice) throw new NotFoundError("Invoice");

  const settings = await CompanySettings.findOne({ userId: req.user!.userId });
  const cust = invoice.customerId as any;
  if (!cust?.email) throw new AppError("Customer has no email address", 400);

  const nodemailer = require("nodemailer");

  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  const symbol = invoice.currency === "EUR" ? "€" : invoice.currency === "DZD" ? "DZD" : "$";
  const itemsHtml = (invoice.items || []).map((item: any) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${symbol}${item.unitPrice.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${symbol}${item.total.toFixed(2)}</td></tr>`
  ).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a1a;color:#fff;padding:20px 30px;display:flex;justify-content:space-between;align-items:center">
        <div><strong style="font-size:18px">${settings?.companyName || "Invoice"}</strong><br><small>${settings?.phone || ""}</small></div>
        <strong style="font-size:24px">INVOICE</strong>
      </div>
      <div style="padding:20px 30px">
        <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
        <p><strong>Due:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}</p>
        <table style="width:100%;border-collapse:collapse;margin:15px 0">
          <thead><tr style="background:#1a1a1a;color:#fff"><th style="padding:8px;text-align:left">Description</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Price</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="text-align:right;font-size:16px"><strong>Total: ${symbol}${invoice.total.toFixed(2)}</strong></p>
        ${invoice.thankYouMessage ? `<p style="margin-top:20px;font-weight:bold">${invoice.thankYouMessage}</p>` : ""}
      </div>
    </div>`;

  const info = await transporter.sendMail({
    from: settings?.companyName || "Invoice Pro",
    to: cust.email,
    subject: `Invoice ${invoice.invoiceNumber} from ${settings?.companyName || "Invoice Pro"}`,
    html,
  });

  if (invoice.status === "draft") {
    await Invoice.findByIdAndUpdate(invoice._id, { $set: { status: "sent", sentAt: new Date() } });
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  res.json({ success: true, message: "Invoice sent successfully", previewUrl: previewUrl || null });
}));

router.post("/:id/whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user!.userId })
    .populate("customerId", "name email phone address city country");
  if (!invoice) throw new NotFoundError("Invoice");

  const cust = invoice.customerId as any;
  if (!cust?.phone) throw new AppError("Customer has no phone number", 400);

  const settings = await CompanySettings.findOne({ userId: req.user!.userId });
  const symbol = invoice.currency === "EUR" ? "€" : invoice.currency === "DZD" ? "DZD" : "$";
  const itemsList = (invoice.items || []).map((item: any, i: number) =>
    `${i + 1}. ${item.description} x${item.quantity} = ${symbol}${item.total.toFixed(2)}`
  ).join("\n");

  const message = `📄 *INVOICE ${invoice.invoiceNumber}*\n${settings?.companyName || ""}\n\n${itemsList}\n\n💵 *Total: ${symbol}${invoice.total.toFixed(2)}*\n📅 Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}\n${invoice.thankYouMessage ? `\n_${invoice.thankYouMessage}_` : ""}`;

  if (config.whatsapp.accessToken && config.whatsapp.phoneId) {
    const waRes = await fetch(`https://graph.facebook.com/v17.0/${config.whatsapp.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cust.phone.replace(/[^0-9]/g, ""),
        type: "text",
        text: { body: message },
      }),
    });
    if (!waRes.ok) {
      const errText = await waRes.text();
      throw new AppError(`WhatsApp API error: ${errText}`, 400);
    }
  }

  if (invoice.status === "draft") {
    await Invoice.findByIdAndUpdate(invoice._id, { $set: { status: "sent", sentAt: new Date() } });
  }

  res.json({ success: true, message: "Invoice sent via WhatsApp", url: `https://wa.me/${cust.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}` });
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user!.userId }).populate("customerId", "name email phone");
  if (!invoice) throw new NotFoundError("Invoice");
  res.json({ success: true, data: invoice });
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.invoiceCount >= user.maxInvoices && user.maxInvoices !== -1)
    throw new AppError("Invoice limit reached. Upgrade your plan.", 403);

  const { customerId, customerName, customerEmail, items, dueDate, notes, currency, invoiceNumber, thankYouMessage } = req.body;
  if (!items?.length || !dueDate) throw new AppError("Missing required fields", 400);

  let finalCustomerId = customerId;

  if (!finalCustomerId && customerName && customerEmail) {
    let existingCustomer = await Customer.findOne({ userId, email: customerEmail });
    if (!existingCustomer) {
      existingCustomer = await Customer.create({ userId, name: customerName, email: customerEmail });
    }
    finalCustomerId = existingCustomer._id;
  }

  if (!finalCustomerId) throw new AppError("Customer required", 400);
  if (!(await Customer.findOne({ _id: finalCustomerId, userId }))) throw new NotFoundError("Customer");

  let invNum = invoiceNumber;
  let defaultCurrency = "USD";
  if (!invNum) {
    let settings = await CompanySettings.findOne({ userId });
    if (!settings) settings = await CompanySettings.create({ userId });
    invNum = `${settings.invoicePrefix}-${new Date().getFullYear()}-${String(settings.nextInvoiceNumber).padStart(4, "0")}`;
    defaultCurrency = settings.defaultCurrency || "USD";
    await CompanySettings.findOneAndUpdate({ userId }, { $inc: { nextInvoiceNumber: 1 } });
  }
  const itemsCalc = items.map((i: any) => ({
    ...i, taxRate: i.tax || i.taxRate || 0,
    total: i.quantity * i.unitPrice * (1 + (i.tax || i.taxRate || 0) / 100),
  }));
  const subtotal = itemsCalc.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = itemsCalc.reduce((s: number, i: any) => s + i.total - i.quantity * i.unitPrice, 0);

  const invoice = await Invoice.create({
    userId, invoiceNumber: invNum, customerId: finalCustomerId, items: itemsCalc,
    subtotal, taxTotal, total: subtotal + taxTotal,
    currency: currency || defaultCurrency, dueDate: new Date(dueDate), notes, thankYouMessage,
  });

  await User.findByIdAndUpdate(userId, { $inc: { invoiceCount: 1 } });
  await Customer.findByIdAndUpdate(finalCustomerId, { $inc: { totalInvoices: 1, totalRevenue: subtotal + taxTotal } });

  res.status(201).json({ success: true, data: invoice });
}));

router.patch("/sync-overdue", asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const result = await Invoice.updateMany(
    { userId: req.user!.userId, dueDate: { $lt: now }, status: { $nin: ["paid", "canceled"] } },
    { $set: { status: "overdue" } }
  );
  res.json({ success: true, modifiedCount: result.modifiedCount });
}));

router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
  const allowed = ["taxRate", "salesTax", "otherCharges", "contactInfo", "paymentInfo", "thankYouMessage", "notes"];
  const update: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  if (Object.keys(update).length === 0) throw new AppError("No valid fields to update", 400);
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.userId },
    { $set: update }, { new: true, runValidators: true }
  );
  if (!invoice) throw new NotFoundError("Invoice");
  res.json({ success: true, data: invoice });
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user!.userId });
  if (!invoice) throw new NotFoundError("Invoice");
  res.json({ success: true, message: "Deleted" });
}));

router.patch("/:id/status", asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const valid = ["draft", "sent", "paid", "overdue", "canceled"];
  if (!valid.includes(status)) throw new AppError("Invalid status", 400);

  const update: any = { status };
  if (status === "paid") update.paidAt = new Date();
  if (status === "sent") update.sentAt = new Date();

  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.userId },
    { $set: update }, { new: true }
  );
  if (!invoice) throw new NotFoundError("Invoice");
  res.json({ success: true, data: invoice });
}));

export default router;
