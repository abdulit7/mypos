const User = require("../models/User");

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      req.flash("error", "You are not authorized to access that page.");
      return res.redirect("/");
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
