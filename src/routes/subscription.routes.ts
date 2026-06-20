import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { config } from "../config";
import Stripe from "stripe";

const router = Router();

const planConfig: Record<string, { maxInvoices: number; features: string[] }> = {
  free: { maxInvoices: 5, features: ["5 invoices/month", "Basic templates", "PDF export", "Email support"] },
  pro_monthly: { maxInvoices: -1, features: ["Unlimited invoices", "Basic templates", "PDF export", "Custom branding", "WhatsApp sharing", "Priority support"] },
  pro_yearly: { maxInvoices: -1, features: ["Unlimited invoices", "Basic templates", "PDF export", "Custom branding", "WhatsApp sharing", "Priority support"] },
  business_monthly: { maxInvoices: -1, features: ["Unlimited invoices", "Basic templates", "PDF export", "Custom branding", "WhatsApp sharing", "Priority support", "Team members (5)", "API access"] },
  business_yearly: { maxInvoices: -1, features: ["Unlimited invoices", "Basic templates", "PDF export", "Custom branding", "WhatsApp sharing", "Priority support", "Team members (5)", "API access"] },
};

router.get("/plans", (_req: Request, res: Response) => {
  const planList = [
    { id: "free", name: "Free", price: 0, currency: "USD", interval: "month", invoiceLimit: 5, features: planConfig.free.features },
    { id: "pro_monthly", name: "Professional", price: 19, currency: "USD", interval: "month", invoiceLimit: -1, features: planConfig.pro_monthly.features },
    { id: "pro_yearly", name: "Professional Annual", price: 190, currency: "USD", interval: "year", invoiceLimit: -1, features: planConfig.pro_yearly.features },
    { id: "business_monthly", name: "Business", price: 49, currency: "USD", interval: "month", invoiceLimit: -1, features: planConfig.business_monthly.features },
    { id: "business_yearly", name: "Business Annual", price: 490, currency: "USD", interval: "year", invoiceLimit: -1, features: planConfig.business_yearly.features },
  ];
  res.json({ success: true, data: planList });
});
router.use(authenticate);

router.get("/current", asyncHandler(async (req: Request, res: Response) => {
  let sub = await Subscription.findOne({ userId: req.user!.userId });
  if (!sub) sub = await Subscription.create({ userId: req.user!.userId, planId: "free", status: "active" });
  res.json({ success: true, data: sub });
}));

router.post("/checkout", asyncHandler(async (req: Request, res: Response) => {
  const { priceId, successUrl, cancelUrl } = req.body;
  if (!priceId) return res.status(400).json({ success: false, error: "Price ID required" });

  if (!config.stripe.secretKey) {
    return res.json({ success: true, data: { url: `${config.frontendUrl}/settings/billing?simulated=true` } });
  }

  const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2023-10-16" as any });
  const user = await User.findById(req.user!.userId);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user._id.toString() } });
    customerId = customer.id;
    await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId, mode: "subscription", payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${config.frontendUrl}/settings/billing?success=true`,
    cancel_url: cancelUrl || `${config.frontendUrl}/settings/billing?canceled=true`,
    metadata: { userId: user._id.toString() },
  });

  res.json({ success: true, data: { url: session.url } });
}));

router.post("/activate", asyncHandler(async (req: Request, res: Response) => {
  const { planId, confirmed } = req.body;
  const planIds = ["free", "pro_monthly", "pro_yearly", "business_monthly", "business_yearly"];
  if (!planIds.includes(planId)) return res.status(400).json({ success: false, error: "Invalid plan" });

  const config = planConfig[planId] || planConfig.free;

  // Free plan → always activate instantly
  if (planId === "free") {
    const [sub] = await Promise.all([
      Subscription.findOneAndUpdate(
        { userId: req.user!.userId },
        { planId, status: "active", features: config.features },
        { new: true, upsert: true }
      ),
      User.findByIdAndUpdate(req.user!.userId, { maxInvoices: config.maxInvoices }),
    ]);
    return res.json({ success: true, data: sub });
  }

  // Check if user already paid for this plan before
  const currentSub = await Subscription.findOne({ userId: req.user!.userId });

  // Retroactively mark current paid plan as paid for existing subscriptions
  if (currentSub && currentSub.planId !== "free" && (!currentSub.paidPlans || !currentSub.paidPlans.includes(currentSub.planId))) {
    await Subscription.findByIdAndUpdate(currentSub._id, { $addToSet: { paidPlans: currentSub.planId } });
    currentSub.paidPlans = [...(currentSub.paidPlans || []), currentSub.planId];
  }

  if (currentSub?.paidPlans?.includes(planId)) {
    // Already paid for this plan → activate instantly
    const [sub] = await Promise.all([
      Subscription.findOneAndUpdate(
        { userId: req.user!.userId },
        { planId, status: "active", features: config.features },
        { new: true, upsert: true }
      ),
      User.findByIdAndUpdate(req.user!.userId, { maxInvoices: config.maxInvoices }),
    ]);
    return res.json({ success: true, data: sub });
  }

  // Coming from checkout with confirmed payment → activate + save to paidPlans
  if (confirmed) {
    // Build $addToSet with both the new plan and the previous paid plan
    const addToPaid: string[] = [planId];
    if (currentSub && currentSub.planId !== "free" && currentSub.planId !== planId) addToPaid.push(currentSub.planId);
    const [sub] = await Promise.all([
      Subscription.findOneAndUpdate(
        { userId: req.user!.userId },
        { $set: { planId, status: "active", features: config.features }, $addToSet: { paidPlans: { $each: addToPaid } } },
        { new: true, upsert: true }
      ),
      User.findByIdAndUpdate(req.user!.userId, { maxInvoices: config.maxInvoices }),
    ]);
    return res.json({ success: true, data: sub });
  }

  // Paid plan and not previously paid → require payment
  return res.json({ success: true, requiresPayment: true, planId });
}));

router.post("/portal", asyncHandler(async (req: Request, res: Response) => {
  if (!config.stripe.secretKey) return res.json({ success: true, data: { url: `${config.frontendUrl}/settings/billing` } });

  const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2023-10-16" as any });
  const user = await User.findById(req.user!.userId);
  if (!user?.stripeCustomerId) return res.status(400).json({ success: false, error: "No Stripe customer" });

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: req.body.returnUrl || `${config.frontendUrl}/settings/billing`,
  });
  res.json({ success: true, data: { url: session.url } });
}));

export default router;
