import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { generateToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { authenticate } from "../middlewares/auth";
import { CompanySettings } from "../models/CompanySettings";

const ADMIN_EMAILS = ["tamernouri10@gmail.com"];

const router = Router();

router.post(
  "/google",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, name, image, googleId } = req.body;
    if (!email || !name || !googleId) throw new AppError("Missing email, name, googleId", 400);

    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        user.image = image || user.image;
        if (isAdmin) user.role = "admin";
        await user.save();
      } else {
        user = await User.create({ email, name, image, googleId, role: isAdmin ? "admin" : "user" });
        await CompanySettings.create({ userId: user._id });
      }
    } else if (isAdmin && user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          invoiceCount: user.invoiceCount,
          maxInvoices: user.maxInvoices,
          locale: user.locale,
          currency: user.currency,
        },
      },
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.userId).select("-__v");
    if (!user) throw new AppError("User not found", 404);
    res.json({ success: true, data: user });
  })
);

export default router;
