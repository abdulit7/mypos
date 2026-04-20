const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { requirePermission } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

function base(req) {
  return `/r/${req.tenantSlug}`;
}

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

router.get("/", requirePermission("products.manage"), async (req, res) => {
  const { q, category } = req.query;
  const filter = { restaurant: req.tenant._id };
  if (q) {
    filter.$or = [{ name: new RegExp(q, "i") }, { sku: new RegExp(q, "i") }];
  }
  if (category) filter.category = category;
  const [products, categories] = await Promise.all([
    Product.find(filter).populate("category").sort({ createdAt: -1 }).lean(),
    Category.find({ restaurant: req.tenant._id }).sort({ name: 1 }).lean(),
  ]);
  res.render("products/index", {
    title: "Products",
    products,
    categories,
    q: q || "",
    selectedCategory: category || "",
  });
});

router.get("/new", requirePermission("products.manage"), async (req, res) => {
  const categories = await Category.find({
    restaurant: req.tenant._id,
    active: true,
  })
    .sort({ name: 1 })
    .lean();
  res.render("products/form", { title: "New Product", product: {}, categories });
});

router.post(
  "/",
  requirePermission("products.manage"),
  upload.single("image"),
  async (req, res) => {
    try {
      await Product.create({
        name: req.body.name.trim(),
        sku: req.body.sku?.trim() || "",
        price: parseFloat(req.body.price) || 0,
        cost: parseFloat(req.body.cost) || 0,
        category: req.body.category,
        description: req.body.description || "",
        image: req.file ? `/uploads/${req.file.filename}` : "",
        active:
          req.body.active === "on" ||
          req.body.active === "true" ||
          req.body.active === undefined,
        restaurant: req.tenant._id,
      });
      req.flash("success", "Product created.");
      res.redirect(`${base(req)}/products`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`${base(req)}/products/new`);
    }
  }
);

router.get("/:id/edit", requirePermission("products.manage"), async (req, res) => {
  const [product, categories] = await Promise.all([
    Product.findOne({
      _id: req.params.id,
      restaurant: req.tenant._id,
    }).lean(),
    Category.find({ restaurant: req.tenant._id, active: true })
      .sort({ name: 1 })
      .lean(),
  ]);
  if (!product) {
    req.flash("error", "Product not found.");
    return res.redirect(`${base(req)}/products`);
  }
  res.render("products/form", { title: "Edit Product", product, categories });
});

router.put(
  "/:id",
  requirePermission("products.manage"),
  upload.single("image"),
  async (req, res) => {
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
      await Product.findOneAndUpdate(
        { _id: req.params.id, restaurant: req.tenant._id },
        update
      );
      req.flash("success", "Product updated.");
      res.redirect(`${base(req)}/products`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`${base(req)}/products/${req.params.id}/edit`);
    }
  }
);

router.delete(
  "/:id",
  requirePermission("products.manage"),
  async (req, res) => {
    await Product.findOneAndDelete({
      _id: req.params.id,
      restaurant: req.tenant._id,
    });
    req.flash("success", "Product deleted.");
    res.redirect(`${base(req)}/products`);
  }
);

module.exports = router;
