// backend/src/index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

import { connectDB, dbState } from "./config/db.js";
import orderRoutes from "./routes/orderRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";

dotenv.config();
const app = express();

/* CORS allowlist (env: CORS_ORIGIN = domain1,domain2,...) */
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const isAllowed = (origin) => {
  if (!origin) return true;                 // health/curl
  if (allowlist.includes("*")) return true;
  if (allowlist.includes(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
};
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowed(origin)),
  methods: ["GET","POST","PATCH","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* Health */
app.get("/", (_req, res) => res.send("MagicSell Backend API running..."));
app.get("/__db", (_req, res) => res.json(dbState()));

/* === DB bağlantısını en başta başlat & tüm istekler onu beklesin === */
const dbReady = connectDB();
app.use(async (_req, res, next) => {
  try { await dbReady; next(); }
  catch (e) { console.error("DB not ready:", e?.message); res.status(500).json({error:"DB not ready"}); }
});

/* Routes */
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/files", fileRoutes);

/* Vercel */
export default app;
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  dbReady.then(() => app.listen(PORT, () => console.log("API on :" + PORT)));
}
