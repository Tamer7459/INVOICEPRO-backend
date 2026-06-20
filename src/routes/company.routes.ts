import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth";
import { CompanySettings } from "../models/CompanySettings";
import { asyncHandler } from "../utils/asyncHandler";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(__dirname, "../../uploads/logos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, uploadDir),
  filename: (_req: any, file: any, cb: any) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req: any, file: any, cb: FileFilterCallback) => {
  if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
  cb(null, true);
} });

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  let settings = await CompanySettings.findOne({ userId: req.user!.userId });
  if (!settings) settings = await CompanySettings.create({ userId: req.user!.userId });
  res.json({ success: true, data: settings });
}));

router.patch("/", upload.single("logo"), asyncHandler(async (req: Request, res: Response) => {
  const update: any = { ...req.body };
  if ((req as any).file) update.logo = `/uploads/logos/${(req as any).file.filename}`;
  const settings = await CompanySettings.findOneAndUpdate(
    { userId: req.user!.userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, data: settings });
}));

export default router;
