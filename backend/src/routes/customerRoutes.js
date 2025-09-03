import express from "express";
import {
  getCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router.get("/", getCustomers);
router.post("/", createCustomer);
router.get("/:id", getCustomerById);
router.patch("/:id", updateCustomer);   // edit
router.delete("/:id", deleteCustomer);  // delete

export default router;
