import express from "express";
import cors from "cors";
import { connectDB, dbState } from "./config/db.js";
// ... diğer importlar

if (!process.env.VERCEL) {
  // sadece local'de .env yükle, prod'da Vercel env'lerinden geliyor
  const dotenv = (await import("dotenv")).default;
  dotenv.config();
}

const app = express();

/* CORS */
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const isAllowed = (origin) => {
  if (!origin) return true;
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

/* Health */
app.get("/", (_req, res) => res.send("MagicSell Backend API running..."));
app.get("/__db", (_req, res) => res.json(dbState()));

/* DB ready middleware (tek bağlan, herkese paylaş) */
let dbPromise;
app.use(async (_req, res, next) => {
  try {
    dbPromise = dbPromise || connectDB();
    await dbPromise;
    return next();
  } catch (e) {
    console.error("DB not ready:", e?.message);
    return res.status(500).json({ error: "DB not ready" });
  }
});

/* Routes */
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/files", fileRoutes);

/* Error handler -> hatayı logla ki 500’lerde ne olduğunu görelim */
app.use((err, _req, res, _next) => {
  console.error("UNHANDLED:", err);
  res.status(500).json({ error: "Internal error" });
});

/* Vercel export / Local listen */
export default app;
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  (dbPromise ||= connectDB()).then(() => {
    app.listen(PORT, () => console.log(`API on :${PORT}`));
  }).catch((err) => {
    console.error("❌ DB startup:", err?.message);
    process.exit(1);
  });
}
