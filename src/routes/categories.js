const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { requirePermission } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

function base(req) {
  return `/r/${req.tenantSlug}`;
}

router.get("/", requirePermission("categories.manage"), async (req, res) => {
  const scope = { restaurant: req.tenant._id };
  const categories = await Category.find(scope).sort({ name: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: scope },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.render("categories/index", {
    title: "Categories",
    categories: categories.map((c) => ({
      ...c,
      productCount: countMap[String(c._id)] || 0,
    })),
  });
});

router.get("/new", requirePermission("categories.manage"), (req, res) => {
  res.render("categories/form", { title: "New Category", category: {} });
});

router.post("/", requirePermission("categories.manage"), async (req, res) => {
  try {
    await Category.create({
      name: req.body.name.trim(),
      description: req.body.description || "",
      active:
        req.body.active === "on" ||
        req.body.active === "true" ||
        req.body.active === undefined,
      restaurant: req.tenant._id,
    });
    req.flash("success", "Category created.");
    res.redirect(`${base(req)}/categories`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`${base(req)}/categories/new`);
  }
});

router.get(
  "/:id/edit",
  requirePermission("categories.manage"),
  async (req, res) => {
    const category = await Category.findOne({
      _id: req.params.id,
      restaurant: req.tenant._id,
    }).lean();
    if (!category) {
      req.flash("error", "Category not found.");
      return res.redirect(`${base(req)}/categories`);
    }
    res.render("categories/form", { title: "Edit Category", category });
  }
);

router.put("/:id", requirePermission("categories.manage"), async (req, res) => {
  try {
    await Category.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.tenant._id },
      {
        name: req.body.name.trim(),
        description: req.body.description || "",
        active: req.body.active === "on" || req.body.active === "true",
      }
    );
    req.flash("success", "Category updated.");
    res.redirect(`${base(req)}/categories`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`${base(req)}/categories/${req.params.id}/edit`);
  }
});

router.delete(
  "/:id",
  requirePermission("categories.manage"),
  async (req, res) => {
    const count = await Product.countDocuments({
      category: req.params.id,
      restaurant: req.tenant._id,
    });
    if (count > 0) {
      req.flash("error", "Cannot delete: category has products.");
      return res.redirect(`${base(req)}/categories`);
    }
    await Category.findOneAndDelete({
      _id: req.params.id,
      restaurant: req.tenant._id,
    });
    req.flash("success", "Category deleted.");
    res.redirect(`${base(req)}/categories`);
  }
);

module.exports = router;
