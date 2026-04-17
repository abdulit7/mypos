const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/image\/(png|jpe?g|webp|gif)/.test(file.mimetype)) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", async (req, res) => {
  const { q, category } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { sku: new RegExp(q, "i") },
    ];
  }
  if (category) filter.category = category;
  const [products, categories] = await Promise.all([
    Product.find(filter).populate("category").sort({ createdAt: -1 }).lean(),
    Category.find().sort({ name: 1 }).lean(),
  ]);
  res.render("products/index", {
    title: "Products",
    products,
    categories,
    q: q || "",
    selectedCategory: category || "",
  });
});

router.get("/new", requireRole("admin"), async (req, res) => {
  const categories = await Category.find({ active: true }).sort({ name: 1 }).lean();
  res.render("products/form", { title: "New Product", product: {}, categories });
});

router.post("/", requireRole("admin"), upload.single("image"), async (req, res) => {
  try {
    await Product.create({
      name: req.body.name.trim(),
      sku: req.body.sku?.trim() || "",
      price: parseFloat(req.body.price) || 0,
      cost: parseFloat(req.body.cost) || 0,
      category: req.body.category,
      description: req.body.description || "",
      image: req.file ? `/uploads/${req.file.filename}` : "",
      active: req.body.active === "on" || req.body.active === "true" || req.body.active === undefined,
    });
    req.flash("success", "Product created.");
    res.redirect("/products");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/products/new");
  }
});

router.get("/:id/edit", requireRole("admin"), async (req, res) => {
  const [product, categories] = await Promise.all([
    Product.findById(req.params.id).lean(),
    Category.find({ active: true }).sort({ name: 1 }).lean(),
  ]);
  if (!product) {
    req.flash("error", "Product not found.");
    return res.redirect("/products");
  }
  res.render("products/form", { title: "Edit Product", product, categories });
});

router.put("/:id", requireRole("admin"), upload.single("image"), async (req, res) => {
  try {
    const update = {
      name: req.body.name.trim(),
      sku: req.body.sku?.trim() || "",
      price: parseFloat(req.body.price) || 0,
      cost: parseFloat(req.body.cost) || 0,
      category: req.body.category,
      description: req.body.description || "",
      active: req.body.active === "on" || req.body.active === "true",
    };
    if (req.file) update.image = `/uploads/${req.file.filename}`;
    await Product.findByIdAndUpdate(req.params.id, update);
    req.flash("success", "Product updated.");
    res.redirect("/products");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`/products/${req.params.id}/edit`);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  req.flash("success", "Product deleted.");
  res.redirect("/products");
});

module.exports = router;
