import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { authenticate } from "../middlewares/auth";
import { Customer } from "../models/Customer";
import { Invoice } from "../models/Invoice";
import { asyncHandler } from "../utils/asyncHandler";
import { NotFoundError, AppError } from "../utils/errors";

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20", search } = req.query;
  const query: any = { userId: req.user!.userId };
  if (search) query.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];

  const p = parseInt(page as string), l = parseInt(limit as string);
  const [data, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    Customer.countDocuments(query),
  ]);

  const customerIds = data.map((c) => c._id);
  const userIdObj = new mongoose.Types.ObjectId(req.user!.userId);
  const counts = await Invoice.aggregate([
    { $match: { userId: userIdObj, customerId: { $in: customerIds } } },
    { $group: { _id: "$customerId", count: { $sum: 1 } } },
  ]);
  const countMap: Record<string, number> = {};
  counts.forEach((c: any) => { countMap[c._id.toString()] = c.count; });

  const dataWithCounts = data.map((c) => ({
    ...c.toObject(),
    invoicesCount: countMap[c._id.toString()] || 0,
  }));

  res.json({ success: true, data: dataWithCounts, meta: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const c = await Customer.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!c) throw new NotFoundError("Customer");
  res.json({ success: true, data: c });
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, address, city, country, taxNumber } = req.body;
  if (!name || !email) throw new AppError("Name and email required", 400);
  if (await Customer.findOne({ userId: req.user!.userId, email })) throw new AppError("Duplicate email", 409);
  const c = await Customer.create({ userId: req.user!.userId, name, email, phone, address, city, country, taxNumber });
  res.status(201).json({ success: true, data: c });
}));

router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
  const c = await Customer.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.userId },
    { $set: req.body }, { new: true, runValidators: true }
  );
  if (!c) throw new NotFoundError("Customer");
  res.json({ success: true, data: c });
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const c = await Customer.findOneAndDelete({ _id: req.params.id, userId: req.user!.userId });
  if (!c) throw new NotFoundError("Customer");
  res.json({ success: true, message: "Deleted" });
}));

export default router;
