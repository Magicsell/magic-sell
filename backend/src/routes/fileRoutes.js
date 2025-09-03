import express from "express";
import { proofUpload, handleProofUpload } from "../controllers/fileController.js";

const router = express.Router();
router.post("/proof", proofUpload.single("file"), handleProofUpload);

export default router;
