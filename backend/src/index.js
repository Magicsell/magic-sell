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

/* CORS – domainlerini buraya ekle */
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const ok = (origin) => {
  if (!origin) return true;
  if (allowlist.includes("*")) return true;
  if (allowlist.includes(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
};
app.use(cors({
  origin: (origin, cb) => cb(null, ok(origin)),
  methods: ["GET","POST","PATCH","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());

app.use(express.json());

/* 🔁 /tmp uploads’ı public’e bağla (prod) + local path */
const uploadsProd = "/tmp/uploads";
const uploadsLocal = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(process.env.VERCEL ? uploadsProd : uploadsLocal));

/* Health */
app.get("/", (_req, res) => res.send("MagicSell Backend API running..."));
app.get("/__db", (_req, res) => res.json(dbState()));

/* DB – tek kez bağlan, tüm isteklerde reuse et */
let dbPromise;
app.use(async (_req, res, next) => {
  try {
    dbPromise ||= connectDB();
    await dbPromise;
    next();
  } catch (e) {
    console.error("DB connect error:", e?.message);
    res.status(500).json({ error: "DB not ready" });
  }
});

/* Routes */
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/files", fileRoutes);

/* Vercel export / Local listen */
export default app;
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  (dbPromise ||= connectDB())
    .then(() => app.listen(PORT, () => console.log(`API on :${PORT}`)));
}
