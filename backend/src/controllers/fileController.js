import multer from "multer";
import path from "path";
import fs from "fs";

// destination'ı dinamik kur: app.get("UPLOAD_ROOT") + "proofs"
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const base = req.app.get("UPLOAD_ROOT") || path.join(process.cwd(), "uploads");
    const dir = path.join(base, "proofs");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file?.originalname || "");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

export const proofUpload = multer({ storage });

export function handleProofUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: "file missing" });

  // public URL için relative path: /uploads + (file.path - UPLOAD_ROOT)
  const base = req.app.get("UPLOAD_ROOT") || path.join(process.cwd(), "uploads");
  const rel = req.file.path
    .replace(base, "")
    .replace(/\\/g, "/"); // windows güvenliği

  return res.json({ url: `/uploads${rel}` });
}
