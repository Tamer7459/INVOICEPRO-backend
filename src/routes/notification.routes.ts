import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth";
import { Notification } from "../models/Notification";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const [data, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).limit(20),
    Notification.countDocuments({ userId: req.user!.userId, read: false }),
  ]);
  res.json({ success: true, data, unreadCount });
}));

router.patch("/:id/read", asyncHandler(async (req: Request, res: Response) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user!.userId }, { read: true });
  res.json({ success: true });
}));

router.post("/read-all", asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ userId: req.user!.userId, read: false }, { read: true });
  res.json({ success: true });
}));

export default router;
