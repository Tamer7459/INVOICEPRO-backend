import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { generateToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/errors";
import { authenticate } from "../middlewares/auth";
import { CompanySettings } from "../models/CompanySettings";
import { config } from "../config";

const ADMIN_EMAILS = ["tamernouri10@gmail.com"];

const router = Router();

// POST /auth/google — accepts { email, name, image, googleId } directly (client-side flow)
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

// GET /auth/google — redirect to Google OAuth consent screen
router.get("/google", (req: Request, res: Response) => {
  const redirectUri = `${config.backendUrl}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.google.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=online`;
  res.redirect(url);
});

// GET /auth/google/callback — handle Google OAuth redirect
router.get("/google/callback", asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) throw new AppError("No authorization code", 400);

  const redirectUri = `${config.backendUrl}/api/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code as string,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData: any = await tokenRes.json();
  if (!tokenRes.ok) throw new AppError("Failed to exchange code: " + (tokenData.error_description || tokenData.error), 400);

  // Decode ID token to get user info
  const parts = tokenData.id_token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const { sub: googleId, email, name, picture: image } = payload;

  const isAdmin = ADMIN_EMAILS.includes((email || "").toLowerCase());

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

  // Redirect back to frontend with token
  res.redirect(`${config.frontendUrl}/login?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&image=${encodeURIComponent(user.image || "")}`);
}));

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
