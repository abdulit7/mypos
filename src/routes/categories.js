const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  const counts = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.render("categories/index", {
    title: "Categories",
    categories: categories.map((c) => ({ ...c, productCount: countMap[String(c._id)] || 0 })),
  });
});

router.get("/new", requireRole("admin"), (req, res) => {
  res.render("categories/form", { title: "New Category", category: {} });
});

router.post("/", requireRole("admin"), async (req, res) => {
  try {
    await Category.create({
      name: req.body.name.trim(),
      description: req.body.description || "",
      active: req.body.active === "on" || req.body.active === "true" || req.body.active === undefined,
    });
    req.flash("success", "Category created.");
    res.redirect("/categories");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/categories/new");
  }
});

router.get("/:id/edit", requireRole("admin"), async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) {
    req.flash("error", "Category not found.");
    return res.redirect("/categories");
  }
  res.render("categories/form", { title: "Edit Category", category });
});

router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, {
      name: req.body.name.trim(),
      description: req.body.description || "",
      active: req.body.active === "on" || req.body.active === "true",
    });
    req.flash("success", "Category updated.");
    res.redirect("/categories");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`/categories/${req.params.id}/edit`);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const count = await Product.countDocuments({ category: req.params.id });
  if (count > 0) {
    req.flash("error", "Cannot delete: category has products.");
    return res.redirect("/categories");
  }
  await Category.findByIdAndDelete(req.params.id);
  req.flash("success", "Category deleted.");
  res.redirect("/categories");
});

module.exports = router;
