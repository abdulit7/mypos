const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Router mounted under /r/:slug via resolveRestaurantBySlug — req.tenant is
// always present here.
const router = express.Router({ mergeParams: true });

router.get("/login", (req, res) => {
  if (req.session && req.session.userId && req.user) {
    if (req.user.role === "superadmin") {
      return res.redirect("/admin/restaurants");
    }
    if (
      req.user.restaurant &&
      String(req.user.restaurant) === String(req.tenant._id)
    ) {
      return res.redirect(`/r/${req.tenant.slug}`);
    }
  }
  res.render("auth/tenant-login", {
    title: `Sign in · ${req.tenant.name}`,
    layout: "layouts/blank",
    tenant: req.tenant,
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const back = `/r/${req.tenant.slug}/login`;
  if (!username || !password) {
    req.flash("error", "Username and password are required.");
    return res.redirect(back);
  }
  if (req.tenant.isActive === false) {
    req.flash("error", "This restaurant is currently suspended. Contact support.");
    return res.redirect(back);
  }
  if (req.tenant.expiresAt && new Date(req.tenant.expiresAt).getTime() < Date.now()) {
    req.flash(
      "error",
      "Your restaurant subscription has expired. Contact support to extend."
    );
    return res.redirect(back);
  }
  const user = await User.findOne({
    username: username.toLowerCase().trim(),
    restaurant: req.tenant._id,
  });
  if (!user) {
    req.flash("error", "Invalid credentials for this restaurant.");
    return res.redirect(back);
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    req.flash("error", "Invalid credentials for this restaurant.");
    return res.redirect(back);
  }
  if (user.active === false) {
    req.flash("error", "Your account is disabled.");
    return res.redirect(back);
  }
  req.session.userId = user._id.toString();
  req.flash("success", `Welcome, ${user.name}!`);
  res.redirect(`/r/${req.tenant.slug}`);
});

// Tenant-scoped logout: drop the session and land on the tenant's login page
// (so the user sees their restaurant's branding, not a bare /login).
router.get("/logout", (req, res) => {
  const slug = req.tenant.slug;
  req.session.destroy(() => res.redirect(`/r/${slug}/login`));
});
router.post("/logout", (req, res) => {
  const slug = req.tenant.slug;
  req.session.destroy(() => res.redirect(`/r/${slug}/login`));
});

module.exports = router;
