import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000"),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  backendUrl: process.env.BACKEND_URL || "http://localhost:4000",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/invoice_pro",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneId: process.env.WHATSAPP_PHONE_ID || "",
  },
  email: {
    apiKey: process.env.EMAIL_API_KEY || "",
    from: process.env.EMAIL_FROM || "noreply@invoicepro.com",
  },
  limits: {
    freeInvoices: 5,
  },
};
