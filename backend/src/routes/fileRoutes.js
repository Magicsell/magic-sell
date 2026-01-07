import express from "express";
import { 
  proofUpload, 
  handleProofUpload, 
  serveProof,
  productImageUpload,
  handleProductImageUpload,
  serveProductImage,
} from "../controllers/fileController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET requests (serving images) are public
router.get("/proofs/:filename", serveProof);
router.get("/products/:filename", serveProductImage);

// POST requests (upload) need authentication
router.post("/proof", authenticateToken, proofUpload.single("file"), handleProofUpload);
router.post("/product-image", authenticateToken, productImageUpload.single("file"), handleProductImageUpload);

export default router;
