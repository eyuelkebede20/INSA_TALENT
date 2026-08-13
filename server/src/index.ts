import express from "express";
import cors from "cors";
import helmet from "helmet";
import 'dotenv/config';
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";

import { studentRouter } from "./routes/student";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { cronRouter } from "./routes/cron";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1); // Trust first proxy (Render/Vercel)

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

// Apply rate limiter to all requests
app.use(limiter);

const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Vercel frontend to fetch from Render backend
  contentSecurityPolicy: false, // Disabled to prevent blocking BetterAuth scripts/iframes
}));

const allowedOrigins = [
  "http://localhost:5173",
  "https://insa-aca.vercel.app",
  process.env.FRONTEND_URL || "https://insa-aca.vercel.app"
];

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth interceptor (Express 5 syntax)
app.all("/api/auth/*catchall", toNodeHandler(auth));

// Custom Routes
app.use("/api/students", studentRouter);
app.use("/api/adminme", adminRouter);
app.use("/api/cron", cronRouter);
app.use("/api", publicRouter);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
