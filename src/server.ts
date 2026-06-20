import express, { Application, Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
import { connectDB } from "./db/connection";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import authRoutes from "./routes/auth.routes";
import invoiceRoutes from "./routes/invoice.routes";
import customerRoutes from "./routes/customer.routes";
import companyRoutes from "./routes/company.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import webhookRoutes from "./routes/webhook.routes";
import adminRoutes from "./routes/admin.routes";
import notificationRoutes from "./routes/notification.routes";
import { setupSockets } from "./sockets";
import { config } from "./config";

import path from "path";
import fs from "fs";

const app: Application = express();
const PORT = config.port;

// Static files
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(limiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Connect DB
connectDB();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// Health
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ name: "Invoice Pro API", version: "1.0.0" });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: config.frontendUrl } });
setupSockets(io);

// Start
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
export { io };
