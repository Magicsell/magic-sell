import express from "express";
import { register, login, getMe, registerCustomer, getOrganizations } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";
import { rateLimitLogin } from "../middleware/rateLimit.js";

const router = express.Router();

// Public routes
router.get("/organizations", getOrganizations); // List active organizations
router.post("/register", register); // Organization + Admin registration
router.post("/register-customer", registerCustomer); // Customer registration
router.post("/login", rateLimitLogin, login); // Rate limiting ekle

// Protected routes
router.get("/me", authenticateToken, getMe);

export default router;

