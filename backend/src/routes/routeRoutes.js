// src/routes/routeRoutes.js
import express from "express";
import { planRoute, planFromOrders,setActiveRoute,getActiveRoute } from "../controllers/routeController.js";
const router = express.Router();

router.post("/plan", planRoute);
router.post("/from-orders", planFromOrders);
router.post("/active", setActiveRoute);
router.get("/active", getActiveRoute);

export default router;
