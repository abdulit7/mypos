const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const { hasPermission, PERMISSIONS } = require("../config/permissions");

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentRestaurant = null;
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
  requireAuth,
  requireSuperAdmin,
  requireRestaurantUser,
  requireRestaurantAdmin,
  requirePermission,
  requireRole,
};
