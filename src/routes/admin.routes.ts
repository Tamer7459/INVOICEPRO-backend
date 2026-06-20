import { Router, Request, Response } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import { User } from "../models/User";
import { Invoice } from "../models/Invoice";
import { Customer } from "../models/Customer";
import { Subscription } from "../models/Subscription";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate);
router.use(authorize("admin"));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  const [totalUsers, totalInvoices, totalCustomers, revenueAgg, subAgg, recentUsers, recentInvoices] = await Promise.all([
    User.countDocuments(),
    Invoice.countDocuments(),
    Customer.countDocuments(),
    Invoice.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Subscription.aggregate([
      { $group: { _id: { planId: "$planId", status: "$status" }, count: { $sum: 1 } } },
    ]),
    User.find().sort({ createdAt: -1 }).limit(10).select("name email role createdAt"),
    Invoice.find().populate("customerId", "name email").sort({ createdAt: -1 }).limit(10),
  ]);

  const dist: Record<string, number> = {};
  let freeCount = 0, proCount = 0, businessCount = 0;
  subAgg.forEach((s: any) => {
    const planId = s._id?.planId || "free";
    dist[planId] = (dist[planId] || 0) + s.count;
    if (planId === "free") freeCount += s.count;
    else if (planId.includes("pro")) proCount += s.count;
    else if (planId.includes("business")) businessCount += s.count;
  });

  res.json({
    success: true,
    data: {
      totalUsers, totalInvoices, totalCustomers,
      totalRevenue: revenueAgg[0]?.total || 0,
      subscriptionDistribution: dist,
      freeSubscriptions: freeCount,
      proSubscriptions: proCount,
      businessSubscriptions: businessCount,
      recentUsers, recentInvoices,
    },
  });
}));

router.get("/users", asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20" } = req.query;
  const p = parseInt(page as string), l = parseInt(limit as string);
  const [data, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).select("-__v"),
    User.countDocuments(),
  ]);
  res.json({ success: true, data, meta: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
}));

router.get("/invoices", asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20", status } = req.query;
  const query: any = {};
  if (status) query.status = status;
  const p = parseInt(page as string), l = parseInt(limit as string);
  const [data, total] = await Promise.all([
    Invoice.find(query).populate("userId", "name email").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    Invoice.countDocuments(query),
  ]);
  res.json({ success: true, data, meta: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
}));

export default router;
