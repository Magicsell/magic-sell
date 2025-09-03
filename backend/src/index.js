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

/* ---------- CORS (allowlist) ---------- */
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const isAllowed = (origin) => {
  if (!origin) return true;                // health check / curl
  if (allowlist.includes("*")) return true;
  if (allowlist.includes(origin)) return true;
  // İstersen Vercel preview’larını da serbest bırak:
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
};

app.use(cors({
  origin: (origin, cb) => cb(null, isAllowed(origin)),
  methods: ["GET","POST","PATCH","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());

/* ---------- Body & static ---------- */
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"))); // Vercel'de kalıcı değildir

/* ---------- Health ---------- */
app.get("/", (_req, res) => res.send("MagicSell Backend API running..."));
app.get("/__db", (_req, res) => res.json(dbState()));

/* ---------- Routes ---------- */
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/files", fileRoutes);

/* ---------- DB bağlan ---------- */
// Vercel: serverless olduğundan 'listen' yok. Bağlantıyı baştan kur.
const dbReady = connectDB();

/* Bu middleware, istek gelmeden önce DB bağlandığından emin olur (serverless için güvenli). */
app.use(async (_req, _res, next) => {
  try { await dbReady; } catch (e) { /* loglanabilir */ }
  next();
});

/* ---------- Export / Local listen ---------- */
export default app; // Vercel için zorunlu

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  // Lokal geliştirme: DB bağlanınca dinle
  dbReady.then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  }).catch(err => {
    console.error("❌ DB connection failed at startup:", err?.message);
    process.exit(1);
  });
}
