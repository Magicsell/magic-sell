import multer from "multer";
import path from "path";
import fs from "fs";

const proofsDir = path.join(process.cwd(), "uploads", "proofs");
fs.mkdirSync(proofsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, proofsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, Date.now() + "-" + Math.random().toString(16).slice(2) + ext);
  },
});

export const proofUpload = multer({ storage });

export function handleProofUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: "file missing" });
  // client’ın kullanacağı public URL
  res.json({ url: `/uploads/proofs/${req.file.filename}` });
}
