import multer from "multer";
import path from "path";
import fs from "fs";

const isVercel = !!process.env.VERCEL;

// Vercel'de yazılabilir tek yer /tmp. Local'de proje klasörü.
const UPLOAD_ROOT = isVercel ? "/tmp" : path.join(process.cwd(), "uploads");

// Hata fırlatmasın; yoksa oluşturmaya çalış, Vercel'de /tmp vardır.
function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (_) {}
}

const proofsDir = path.join(UPLOAD_ROOT, "proofs");
ensureDir(proofsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file?.originalname || "");
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

export const proofUpload = multer({ storage });

// Prod'da /tmp altına yazıyoruz; statik servis edemeyiz. Bu yüzden GET route ile döndür.
export function handleProofUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: "file missing" });
  const filename = req.file.filename;
  // Local'de /uploads/proofs/... çalışsın diye eski URL'yi koruyoruz, ama Vercel'de API'den okuyacağız.
  const url = process.env.VERCEL
    ? `/api/files/proofs/${filename}`
    : `/uploads/proofs/${filename}`;
  res.json({ url });
}

// Vercel'de kayıtlı resmi stream'lemek için:
export function serveProof(req, res) {
  const file = path.join(proofsDir, req.params.filename);
  fs.stat(file, (err) => {
    if (err) return res.status(404).end();
    res.sendFile(file);
  });
}
