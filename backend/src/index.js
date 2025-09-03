import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB, dbState } from "./config/db.js";
import orderRoutes from "./routes/orderRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (_req, res) => res.send("MagicSell Backend API running..."));
app.get("/__db", (_req, res) => res.json(dbState())); // hızlı teşhis için
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// routes (DB bağlanınca aktif olacak)
app.use("/api/orders", orderRoutes);
app.use("/api/customers",customerRoutes)
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/files", fileRoutes);


const PORT = process.env.PORT || 5000;

// 🔴 Sunucuyu ancak DB bağlandıktan sonra başlat
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ DB connection failed at startup:", err?.message);
    process.exit(1);
  });
