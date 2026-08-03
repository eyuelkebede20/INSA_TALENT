import express from "express";
import cors from "cors";
import 'dotenv/config';
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";

import { studentRouter } from "./routes/student";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.VITE_API_BASE_URL?.replace('/api', '') || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth interceptor (Express 5 syntax)
app.all("/api/auth/*catchall", toNodeHandler(auth));

// Custom Routes
app.use("/api/students", studentRouter);
app.use("/api/admin", adminRouter);
app.use("/api", publicRouter);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
