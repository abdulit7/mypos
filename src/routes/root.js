const express = require("express");
const Restaurant = require("../models/Restaurant");

const router = express.Router();

// Marketing landing (public-facing single-page site advertising the product).
// Signed-in users are forwarded to their restaurant / super-admin console so
// they don't land on the marketing page by accident.
router.get("/", async (req, res) => {
  if (req.user && req.user.role === "superadmin") {
    return res.redirect("/admin/restaurants");
  }
  if (req.user && req.user.restaurant && req.restaurant && req.restaurant.slug) {
    return res.redirect(`/r/${req.restaurant.slug}`);
  }
  res.render("marketing/index", {
    title: "Food Point POS — Modern Point of Sale for Restaurants",
    layout: "layouts/marketing",
  });
});

// Restaurant chooser (formerly /): lists active tenants so a cashier or admin
// can pick the restaurant they belong to and reach its login page.
router.get("/restaurants", async (req, res) => {
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
    title: "Choose your restaurant",
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
