const express = require("express");
const Restaurant = require("../models/Restaurant");
const { requirePermission } = require("../middleware/auth");
const { logoUpload, publicLogoUrl } = require("../middleware/uploads");

const router = express.Router();

// Only restaurant admins (and superadmins) can manage their own restaurant's
// branding / address / currency. Anyone from the tenant can view it (read-only).
router.get("/", (req, res) => {
  res.render("settings/index", {
    title: "Restaurant settings",
    restaurant: req.tenant,
    canEdit:
      req.user.role === "admin" ||
      req.user.role === "superadmin" ||
      (req.user.permissions || []).includes("users.manage"),
  });
});

router.post(
  "/",
  requirePermission("users.manage"),
  logoUpload.single("logo"),
  async (req, res) => {
    try {
      const r = await Restaurant.findById(req.tenant._id);
      if (!r) return res.redirect(`/r/${req.tenantSlug}/settings`);
      const { name, ownerName, phone, address, currency, taxRate, themeColor, tagline } =
        req.body;
      if (name) r.name = String(name).trim();
      r.ownerName = ownerName || "";
      r.phone = phone || "";
      r.address = address || "";
      r.currency = currency || "Rs";
      r.taxRate = Number.isFinite(parseFloat(taxRate)) ? parseFloat(taxRate) : 0;
      if (themeColor) r.themeColor = themeColor;
      r.tagline = tagline || "";
      if (req.file) r.logoUrl = publicLogoUrl(req.file.filename);
      await r.save();
      req.flash("success", "Restaurant settings updated.");
      res.redirect(`/r/${req.tenantSlug}/settings`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`/r/${req.tenantSlug}/settings`);
    }
  }
);

// Quick "remove logo" endpoint
router.post(
  "/logo/remove",
  requirePermission("users.manage"),
  async (req, res) => {
    await Restaurant.findByIdAndUpdate(req.tenant._id, { logoUrl: "" });
    req.flash("success", "Logo removed.");
    res.redirect(`/r/${req.tenantSlug}/settings`);
  }
);

module.exports = router;
