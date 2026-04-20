const express = require("express");
const Restaurant = require("../models/Restaurant");

const router = express.Router();

// Landing page: shows a chooser of restaurants + a link to the super-admin login.
// If the user is already signed in, forwards them to their restaurant dashboard
// or the super-admin console.
router.get("/", async (req, res) => {
  if (req.user && req.user.role === "superadmin") {
    return res.redirect("/admin/restaurants");
  }
  if (req.user && req.user.restaurant && req.restaurant && req.restaurant.slug) {
    return res.redirect(`/r/${req.restaurant.slug}`);
  }
  const restaurants = await Restaurant.find({ isActive: true })
    .sort({ name: 1 })
    .select("name slug logoUrl tagline")
    .lean();
  res.render("landing/index", {
    title: "Welcome",
    layout: "layouts/blank",
    restaurants,
  });
});

// Generic /login disambiguator: if the user types /login, send them to the
// landing page so they can pick their restaurant (or the super-admin link).
router.get("/login", (req, res) => {
  if (req.user && req.user.role === "superadmin") {
    return res.redirect("/admin/restaurants");
  }
  if (req.user && req.restaurant && req.restaurant.slug) {
    return res.redirect(`/r/${req.restaurant.slug}`);
  }
  return res.redirect("/");
});

// Shared logout: nuke session and flash the reason on the next page.
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
