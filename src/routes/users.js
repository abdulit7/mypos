const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { requirePermission } = require("../middleware/auth");
const {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  DEFAULT_CASHIER_PERMISSIONS,
} = require("../config/permissions");

const router = express.Router({ mergeParams: true });

router.use(requirePermission("users.manage"));

function base(req) {
  return `/r/${req.tenantSlug}`;
}

function sanitizePermissions(raw) {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.filter((p) => ALL_PERMISSION_KEYS.includes(p));
}

router.get("/", async (req, res) => {
  const users = await User.find({ restaurant: req.tenant._id })
    .sort({ createdAt: 1 })
    .lean();
  res.render("users/index", {
    title: "Users",
    users,
    maxUsers: req.tenant.maxUsers,
  });
});

router.get("/new", (req, res) => {
  res.render("users/form", {
    title: "New User",
    user: { role: "cashier", permissions: DEFAULT_CASHIER_PERMISSIONS, active: true },
    permissionDefs: PERMISSIONS,
    isNew: true,
  });
});

router.post("/", async (req, res) => {
  try {
    const { name, username, password, role, permissions, active } = req.body;
    if (!name || !username || !password) {
      req.flash("error", "Name, username, and password are required.");
      return res.redirect(`${base(req)}/users/new`);
    }
    const count = await User.countDocuments({ restaurant: req.tenant._id });
    if (count >= req.tenant.maxUsers) {
      req.flash(
        "error",
        `User limit reached (${req.tenant.maxUsers}). Contact support to raise it.`
      );
      return res.redirect(`${base(req)}/users`);
    }
    const uname = username.trim().toLowerCase();
    // Uniqueness is scoped to this restaurant now — two tenants can share names.
    if (await User.findOne({ username: uname, restaurant: req.tenant._id })) {
      req.flash("error", `Username '${uname}' is already taken in this restaurant.`);
      return res.redirect(`${base(req)}/users/new`);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const safeRole = ["admin", "cashier"].includes(role) ? role : "cashier";
    await User.create({
      name: name.trim(),
      username: uname,
      passwordHash,
      role: safeRole,
      restaurant: req.tenant._id,
      permissions: safeRole === "admin" ? [] : sanitizePermissions(permissions),
      active: active === "on" || active === "true" || active === undefined,
    });
    req.flash("success", `User '${uname}' created.`);
    res.redirect(`${base(req)}/users`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`${base(req)}/users/new`);
  }
});

router.get("/:id/edit", async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    restaurant: req.tenant._id,
  }).lean();
  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect(`${base(req)}/users`);
  }
  res.render("users/form", {
    title: `Edit · ${user.name}`,
    user,
    permissionDefs: PERMISSIONS,
    isNew: false,
  });
});

router.put("/:id", async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      restaurant: req.tenant._id,
    });
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect(`${base(req)}/users`);
    }
    const { name, password, role, permissions, active } = req.body;
    user.name = (name || user.name).trim();
    if (password && password.length >= 4) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    if (user.role === "admin" && role === "cashier") {
      const adminCount = await User.countDocuments({
        restaurant: req.tenant._id,
        role: "admin",
        _id: { $ne: user._id },
      });
      if (adminCount === 0) {
        req.flash("error", "At least one admin must remain for this restaurant.");
        return res.redirect(`${base(req)}/users/${user._id}/edit`);
      }
    }
    const safeRole = ["admin", "cashier"].includes(role) ? role : user.role;
    user.role = safeRole;
    user.permissions =
      safeRole === "admin" ? [] : sanitizePermissions(permissions);
    user.active = active === "on" || active === "true";
    await user.save();
    req.flash("success", "User updated.");
    res.redirect(`${base(req)}/users`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect(`${base(req)}/users/${req.params.id}/edit`);
  }
});

router.delete("/:id", async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    restaurant: req.tenant._id,
  });
  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect(`${base(req)}/users`);
  }
  if (String(user._id) === String(req.user._id)) {
    req.flash("error", "You cannot delete your own account.");
    return res.redirect(`${base(req)}/users`);
  }
  if (user.role === "admin") {
    const adminCount = await User.countDocuments({
      restaurant: req.tenant._id,
      role: "admin",
    });
    if (adminCount <= 1) {
      req.flash("error", "At least one admin must remain.");
      return res.redirect(`${base(req)}/users`);
    }
  }
  await User.findByIdAndDelete(user._id);
  req.flash("success", "User deleted.");
  res.redirect(`${base(req)}/users`);
});

module.exports = router;
