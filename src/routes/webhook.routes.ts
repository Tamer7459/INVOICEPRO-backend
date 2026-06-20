import express, { Router, Request, Response } from "express";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { config } from "../config";
import Stripe from "stripe";

const router = Router();

router.post("/stripe", express.raw({ type: "application/json" }), asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!config.stripe.webhookSecret || !config.stripe.secretKey) {
    console.log("Webhook (simulated):", (req.body as any)?.type);
    return res.json({ received: true });
  }

  const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2023-10-16" as any });
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.userId;
      if (uid) {
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        await Subscription.findOneAndUpdate({ userId: uid }, {
          stripeSubscriptionId: subId, stripePriceId: sub.items.data[0]?.price.id,
          status: sub.status, planId: "pro_monthly", cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        }, { upsert: true });
        await User.findByIdAndUpdate(uid, { maxInvoices: -1, "subscription.planId": "pro_monthly", "subscription.status": sub.status });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.userId;
      if (uid) {
        await Subscription.findOneAndUpdate({ stripeSubscriptionId: sub.id }, { status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end });
        await User.findByIdAndUpdate(uid, { "subscription.status": sub.status });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const dSub = event.data.object as Stripe.Subscription;
      const dUid = dSub.metadata?.userId;
      if (dUid) {
        await Subscription.findOneAndUpdate({ stripeSubscriptionId: dSub.id }, { status: "canceled" });
        await User.findByIdAndUpdate(dUid, { maxInvoices: 5, "subscription.planId": "free", "subscription.status": "canceled" });
      }
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as any;
      const fUid = inv.metadata?.userId;
      if (fUid) {
        await Subscription.findOneAndUpdate({ userId: fUid }, { status: "past_due" });
        await User.findByIdAndUpdate(fUid, { "subscription.status": "past_due" });
      }
      break;
    }
  }

  res.json({ received: true });
}));

export default router;
