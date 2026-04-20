const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const { hasPermission, PERMISSIONS } = require("../config/permissions");

function defaultRurl(path) {
  return path || "/";
}

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentRestaurant = null;
  res.locals.tenantSlug = null;
  res.locals.tenantBase = "";
  res.locals.rurl = defaultRurl;
  res.locals.hasPermission = (perm) => hasPermission(req.user, perm);
  res.locals.PERMISSIONS = PERMISSIONS;

  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user && user.active !== false) {
        req.user = user;
        res.locals.currentUser = user;
        if (user.restaurant) {
          const restaurant = await Restaurant.findById(user.restaurant).lean();
          if (restaurant) {
            req.restaurant = restaurant;
            res.locals.currentRestaurant = restaurant;
          }
        }
        res.locals.hasPermission = (perm) => hasPermission(user, perm);
      }
    } catch (err) {
      // ignore
    }
  }
  next();
}

// Resolves a restaurant by the `:slug` URL param. Attaches `req.tenant` and
// sets a per-tenant `rurl` helper on res.locals so views can build URLs like
// `<%= rurl('/pos') %>` → `/r/<slug>/pos`.
async function resolveRestaurantBySlug(req, res, next) {
  const slug = (req.params.slug || "").toLowerCase();
  if (!slug) {
    return res.status(404).render("404", { title: "Not Found", layout: "layouts/blank" });
  }
  const tenant = await Restaurant.findOne({ slug }).lean();
  if (!tenant) {
    return res.status(404).render("404", { title: "Not Found", layout: "layouts/blank" });
  }
  req.tenant = tenant;
  req.tenantSlug = slug;
  res.locals.tenant = tenant;
  res.locals.tenantSlug = slug;
  res.locals.tenantBase = `/r/${slug}`;
  res.locals.rurl = (p) => {
    if (!p) return `/r/${slug}`;
    if (p.startsWith("http")) return p;
    if (p.startsWith("/r/") || p === "/logout" || p.startsWith("/admin/")) return p;
    return `/r/${slug}${p.startsWith("/") ? p : `/${p}`}`.replace(/\/$/, "") || `/r/${slug}`;
  };
  // For display, keep currentRestaurant aligned with the URL tenant (so the
  // header shows the right name even when a superadmin is browsing into it).
  res.locals.currentRestaurant = tenant;
  next();
}

// For routes mounted under `/r/:slug`, require the logged-in user belongs to
// that tenant (or is a superadmin). Also enforces suspension + expiry.
function requireTenantMember(req, res, next) {
  if (!req.user) {
    req.flash("error", "Please sign in to continue.");
    return res.redirect(`/r/${req.tenantSlug}/login`);
  }
  if (req.user.role === "superadmin") {
    // Superadmin can browse any tenant's pages for support purposes.
    req.restaurant = req.tenant;
    return next();
  }
  if (String(req.user.restaurant) !== String(req.tenant._id)) {
    req.flash("error", "You don't have access to that restaurant.");
    return res.redirect("/login");
  }
  if (req.tenant.isActive === false) {
    req.flash("error", "This restaurant is currently suspended. Contact support.");
    return res.redirect(`/r/${req.tenantSlug}/login`);
  }
  if (req.tenant.expiresAt && new Date(req.tenant.expiresAt).getTime() < Date.now()) {
    req.flash(
      "error",
      "Your restaurant subscription has expired. Contact support to extend."
    );
    return res.redirect(`/r/${req.tenantSlug}/login`);
  }
  req.restaurant = req.tenant; // back-compat with existing routes
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.flash("error", "Please sign in to continue.");
    return res.redirect("/login");
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "superadmin") {
    req.flash("error", "Super admin access required.");
    return res.redirect("/");
  }
  next();
}

function requireRestaurantUser(req, res, next) {
  if (!req.user) {
    req.flash("error", "Please sign in to continue.");
    return res.redirect("/login");
  }
  if (req.user.role === "superadmin") {
    return res.redirect("/superadmin/restaurants");
  }
  if (!req.user.restaurant || !req.restaurant) {
    req.flash("error", "Your account is not linked to a restaurant.");
    return res.redirect("/login");
  }
  if (req.restaurant.isActive === false) {
    req.flash("error", "Your restaurant is currently suspended. Contact support.");
    return res.redirect("/logout");
  }
  if (req.restaurant.expiresAt && new Date(req.restaurant.expiresAt).getTime() < Date.now()) {
    req.flash(
      "error",
      "Your restaurant subscription has expired. Contact support to extend."
    );
    return res.redirect("/logout");
  }
  next();
}

function requireRestaurantAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    req.flash("error", "Admin access required.");
    return res.redirect("/");
  }
  next();
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) {
      req.flash("error", "Please sign in to continue.");
      return res.redirect("/login");
    }
    if (!hasPermission(req.user, perm)) {
      req.flash("error", "You don't have permission to do that.");
      return res.redirect("/");
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      req.flash("error", "You are not authorized to access that page.");
      return res.redirect("/");
    }
    next();
  };
}

module.exports = {
  attachUser,
  resolveRestaurantBySlug,
  requireTenantMember,
  requireAuth,
  requireSuperAdmin,
  requireRestaurantUser,
  requireRestaurantAdmin,
  requirePermission,
  requireRole,
};
