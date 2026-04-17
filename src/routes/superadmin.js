const express = require("express");
const bcrypt = require("bcryptjs");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireSuperAdmin);

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base) {
  let slug = base || `restaurant-${Date.now()}`;
  let i = 1;
  while (await Restaurant.findOne({ slug })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

// Dashboard
router.get("/", async (req, res) => {
  const [restaurantCount, activeCount, expiredCount, userCount, orderCount, recent] =
    await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ isActive: true }),
      Restaurant.countDocuments({
        expiresAt: { $ne: null, $lt: new Date() },
      }),
      User.countDocuments({ role: { $ne: "superadmin" } }),
      Order.countDocuments({ status: "completed" }),
      Restaurant.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);
  res.render("superadmin/dashboard", {
    title: "Super Admin",
    layout: "layouts/superadmin",
    stats: { restaurantCount, activeCount, expiredCount, userCount, orderCount },
    recent,
  });
});

// Restaurants list
router.get("/restaurants", async (req, res) => {
  const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();
  const userCounts = await User.aggregate([
    { $match: { restaurant: { $ne: null } } },
    { $group: { _id: "$restaurant", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(userCounts.map((c) => [String(c._id), c.count]));
  const enriched = restaurants.map((r) => ({
    ...r,
    userCount: countMap[String(r._id)] || 0,
    expired: !!(r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()),
  }));
  res.render("superadmin/restaurants/index", {
    title: "Restaurants",
    layout: "layouts/superadmin",
    restaurants: enriched,
  });
});

router.get("/restaurants/new", (req, res) => {
  res.render("superadmin/restaurants/form", {
    title: "New Restaurant",
    layout: "layouts/superadmin",
    restaurant: { maxUsers: 5, isActive: true },
    adminDefaults: { name: "", username: "", password: "" },
  });
});

router.post("/restaurants", async (req, res) => {
  try {
    const {
      name,
      ownerName,
      phone,
      address,
      taxRate,
      currency,
      maxUsers,
      expiresAt,
      isActive,
      adminName,
      adminUsername,
      adminPassword,
    } = req.body;

    if (!name || !adminUsername || !adminPassword) {
      req.flash("error", "Restaurant name, admin username and password are required.");
      return res.redirect("/superadmin/restaurants/new");
    }

    const slug = await ensureUniqueSlug(slugify(name));
    const restaurant = await Restaurant.create({
      name: name.trim(),
      slug,
      ownerName: ownerName || "",
      phone: phone || "",
      address: address || "",
      taxRate: parseFloat(taxRate) || 0,
      currency: currency || "Rs",
      maxUsers: parseInt(maxUsers, 10) || 5,
      isActive: isActive === "on" || isActive === "true" || isActive === undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id,
    });

    const username = adminUsername.trim().toLowerCase();
    if (await User.findOne({ username })) {
      await Restaurant.findByIdAndDelete(restaurant._id);
      req.flash("error", `Username '${username}' already exists.`);
      return res.redirect("/superadmin/restaurants/new");
    }
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      name: adminName || "Admin",
      username,
      passwordHash,
      role: "admin",
      restaurant: restaurant._id,
      permissions: [],
    });

    req.flash("success", `Restaurant '${restaurant.name}' created with admin '${username}'.`);
    res.redirect(`/superadmin/restaurants/${restaurant._id}`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/superadmin/restaurants/new");
  }
});

router.get("/restaurants/:id", async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id).lean();
  if (!restaurant) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  const [users, productCount, orderCount, revenueAgg] = await Promise.all([
    User.find({ restaurant: restaurant._id }).sort({ createdAt: 1 }).lean(),
    Product.countDocuments({ restaurant: restaurant._id }),
    Order.countDocuments({ restaurant: restaurant._id, status: "completed" }),
    Order.aggregate([
      { $match: { restaurant: restaurant._id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);
  res.render("superadmin/restaurants/show", {
    title: restaurant.name,
    layout: "layouts/superadmin",
    restaurant: {
      ...restaurant,
      expired: !!(
        restaurant.expiresAt && new Date(restaurant.expiresAt).getTime() < Date.now()
      ),
    },
    users,
    productCount,
    orderCount,
    revenue: revenueAgg[0]?.total || 0,
  });
});

router.get("/restaurants/:id/edit", async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id).lean();
  if (!restaurant) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  res.render("superadmin/restaurants/form", {
    title: `Edit · ${restaurant.name}`,
    layout: "layouts/superadmin",
    restaurant,
    adminDefaults: null,
  });
});

router.put("/restaurants/:id", async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) {
      req.flash("error", "Restaurant not found.");
      return res.redirect("/superadmin/restaurants");
    }
    const {
      name,
      ownerName,
      phone,
      address,
      taxRate,
      currency,
      maxUsers,
      expiresAt,
      isActive,
    } = req.body;
    r.name = (name || r.name).trim();
    r.ownerName = ownerName || "";
    r.phone = phone || "";
    r.address = address || "";
    r.taxRate = parseFloat(taxRate) || 0;
    r.currency = currency || "Rs";
    r.maxUsers = parseInt(maxUsers, 10) || 1;
    r.isActive = isActive === "on" || isActive === "true";
    r.expiresAt = expiresAt ? new Date(expiresAt) : null;
    await r.save();
    req.flash("success", "Restaurant updated.");
    res.redirect(`/superadmin/restaurants/${r._id}`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`/superadmin/restaurants/${req.params.id}/edit`);
  }
});

router.post("/restaurants/:id/extend", async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  const days = parseInt(req.body.days, 10) || 30;
  const base =
    r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
      ? new Date(r.expiresAt)
      : new Date();
  r.expiresAt = new Date(base.getTime() + days * 24 * 3600 * 1000);
  await r.save();
  req.flash("success", `Extended by ${days} days. New expiry: ${r.expiresAt.toISOString().slice(0, 10)}.`);
  res.redirect(`/superadmin/restaurants/${r._id}`);
});

router.post("/restaurants/:id/toggle", async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  r.isActive = !r.isActive;
  await r.save();
  req.flash("success", `Restaurant ${r.isActive ? "activated" : "suspended"}.`);
  res.redirect(`/superadmin/restaurants/${r._id}`);
});

router.delete("/restaurants/:id", async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  await User.deleteMany({ restaurant: r._id });
  await Product.deleteMany({ restaurant: r._id });
  const Category = require("../models/Category");
  await Category.deleteMany({ restaurant: r._id });
  await Order.deleteMany({ restaurant: r._id });
  await Restaurant.findByIdAndDelete(r._id);
  req.flash("success", `Restaurant '${r.name}' and all its data deleted.`);
  res.redirect("/superadmin/restaurants");
});

// Reset admin password for a restaurant
router.post("/restaurants/:id/reset-admin", async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) {
    req.flash("error", "Restaurant not found.");
    return res.redirect("/superadmin/restaurants");
  }
  const password = req.body.password;
  if (!password || password.length < 4) {
    req.flash("error", "Password must be at least 4 characters.");
    return res.redirect(`/superadmin/restaurants/${r._id}`);
  }
  const admin = await User.findOne({ restaurant: r._id, role: "admin" }).sort({ createdAt: 1 });
  if (!admin) {
    req.flash("error", "No admin user found for this restaurant.");
    return res.redirect(`/superadmin/restaurants/${r._id}`);
  }
  admin.passwordHash = await bcrypt.hash(password, 10);
  await admin.save();
  req.flash("success", `Password reset for ${admin.username}.`);
  res.redirect(`/superadmin/restaurants/${r._id}`);
});

module.exports = router;
