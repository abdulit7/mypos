const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/");
  res.render("auth/login", { title: "Sign in", layout: "layouts/blank" });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash("error", "Username and password are required.");
    return res.redirect("/login");
  }
  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) {
    req.flash("error", "Invalid credentials.");
    return res.redirect("/login");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    req.flash("error", "Invalid credentials.");
    return res.redirect("/login");
  }
  req.session.userId = user._id.toString();
  req.flash("success", `Welcome, ${user.name}!`);
  res.redirect("/");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
