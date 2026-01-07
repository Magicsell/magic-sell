import express from "express";
import { requireRole } from "../middleware/auth.js";
import {
  getUsers,
  getUserById,
  createUser,
  approveUser,
  rejectUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = express.Router();

// All routes require admin role (authentication and tenant middleware already applied in index.js)
router.use(requireRole("admin"));

router.get("/", getUsers);
router.post("/", createUser);
router.get("/:id", getUserById);
router.patch("/:id/approve", approveUser);
router.patch("/:id/reject", rejectUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
