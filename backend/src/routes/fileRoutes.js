import { Router } from "express";
import { proofUpload, handleProofUpload } from "../controllers/fileController.js";

const router = Router();
router.post("/proof", proofUpload.single("file"), handleProofUpload);

export default router;
