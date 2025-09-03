import multer from "multer";
import path from "path";
import fs from "fs";

// ❗ Serverless'ta kalıcı disk yok. Vercel'de tek yazılabilir klasör /tmp
const baseDir = process.env.NODE_ENV === "production"
  ? "/tmp"                      // Vercel
  : process.cwd();              // local dev

const proofsDir = path.join(baseDir, "uploads", "proofs");
fs.mkdirSync(proofsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file?.originalname || "");
    cb(null, Date.now() + "-" + Math.random().toString(16).slice(2) + ext);
  },
});

export const proofUpload = multer({ storage });

export function handleProofUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: "file missing" });
  // Client’a dönülen public URL. /tmp’yi /uploads altına mount ettiğimiz için bu path çalışacak.
  res.json({ url: `/uploads/proofs/${req.file.filename}` });
}
