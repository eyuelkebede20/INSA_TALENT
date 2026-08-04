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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Vercel frontend to fetch from Render backend
  contentSecurityPolicy: false, // Disabled to prevent blocking BetterAuth scripts/iframes
}));

const allowedOrigins = [
  "http://localhost:5173",
  "https://insa-talent.vercel.app",
  process.env.FRONTEND_URL || "https://insa-talent.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, allowedOrigins[1]); // Fallback to Vercel
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth interceptor (Express 5 syntax)
app.all("/api/auth/*catchall", toNodeHandler(auth));

// Custom Routes
app.use("/api/students", studentRouter);
app.use("/api/admin", adminRouter);
app.use("/api/cron", cronRouter);
app.use("/api", publicRouter);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
