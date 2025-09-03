import express from "express";
import { proofUpload, handleProofUpload, serveProof } from "../controllers/fileController.js";

const router = express.Router();

router.post("/proof", proofUpload.single("file"), handleProofUpload);

// Vercel'de /tmp'den okumak için (Local'de de çalışır):
router.get("/proofs/:filename", serveProof);

export default router;
