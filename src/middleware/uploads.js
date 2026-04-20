const path = require("path");
const fs = require("fs");
const multer = require("multer");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "public", "uploads");
const LOGOS_DIR = path.join(UPLOAD_ROOT, "logos");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(UPLOAD_ROOT);
ensureDir(LOGOS_DIR);

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    const slug = (req.params.slug || req.body.slug || "r").replace(/[^a-z0-9-]/gi, "");
    const ext = (path.extname(file.originalname || ".png") || ".png").toLowerCase();
    cb(null, `${slug || "r"}-${Date.now()}${ext}`);
  },
});

const logoFilter = (_req, file, cb) => {
  const ok =
    /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.mimetype) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.originalname || "");
  if (!ok) return cb(new Error("Only image files (png/jpg/webp/gif/svg) are allowed."));
  cb(null, true);
};

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: logoFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

function publicLogoUrl(filename) {
  if (!filename) return "";
  if (filename.startsWith("/") || filename.startsWith("http")) return filename;
  return `/uploads/logos/${filename}`;
}

module.exports = { logoUpload, publicLogoUrl, UPLOAD_ROOT, LOGOS_DIR };
