import express from "express";
import {
  getOrders,
  createOrder,
  updateOrderStatus,
  deliverOrder,
  updateOrder,
  getOrderById,
  deleteOrder,
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", getOrders);
router.delete("/:id", deleteOrder);
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/deliver", deliverOrder);
router.patch("/:id", updateOrder);

export default router;
