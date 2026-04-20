require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");

const connectDatabase = require("./src/config/db");
const { ensureSeedData } = require("./src/config/seed");

const authRoutes = require("./src/routes/auth");
const dashboardRoutes = require("./src/routes/dashboard");
const categoryRoutes = require("./src/routes/categories");
const productRoutes = require("./src/routes/products");
const posRoutes = require("./src/routes/pos");
const orderRoutes = require("./src/routes/orders");
const reportRoutes = require("./src/routes/reports");
const superadminRoutes = require("./src/routes/superadmin");
const userRoutes = require("./src/routes/users");
const settingsRoutes = require("./src/routes/settings");
const rootRoutes = require("./src/routes/root");

const {
  attachUser,
  resolveRestaurantBySlug,
  requireTenantMember,
  requireAuth,
} = require("./src/middleware/auth");

async function bootstrap() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  const mongoUri = await connectDatabase();

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/main");

  app.use(morgan("dev"));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride("_method"));
  app.use(express.static(path.join(__dirname, "public")));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "mypos-dev-secret",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: mongoUri }),
      cookie: { maxAge: 1000 * 60 * 60 * 8 },
    })
  );
  app.use(flash());

  app.use(attachUser);
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.appName = "Food Point POS";
    res.locals.path = req.path;
    next();
  });

  // Landing + auth chooser routes (public)
  app.use("/", rootRoutes);
  // Per-restaurant login / logout (public)
  app.use("/r/:slug", resolveRestaurantBySlug, authRoutes);

  // Super admin namespace
  app.use("/admin", superadminRoutes);

  // Everything tenant-scoped lives under /r/:slug/... and is resolved by slug.
  app.use(
    "/r/:slug",
    resolveRestaurantBySlug,
    requireTenantMember,
    dashboardRoutes
  );
  app.use(
    "/r/:slug/categories",
    resolveRestaurantBySlug,
    requireTenantMember,
    categoryRoutes
  );
  app.use(
    "/r/:slug/products",
    resolveRestaurantBySlug,
    requireTenantMember,
    productRoutes
  );
  app.use(
    "/r/:slug/pos",
    resolveRestaurantBySlug,
    requireTenantMember,
    posRoutes
  );
  app.use(
    "/r/:slug/orders",
    resolveRestaurantBySlug,
    requireTenantMember,
    orderRoutes
  );
  app.use(
    "/r/:slug/reports",
    resolveRestaurantBySlug,
    requireTenantMember,
    reportRoutes
  );
  app.use(
    "/r/:slug/users",
    resolveRestaurantBySlug,
    requireTenantMember,
    userRoutes
  );
  app.use(
    "/r/:slug/settings",
    resolveRestaurantBySlug,
    requireTenantMember,
    settingsRoutes
  );

  app.use((req, res) => {
    res.status(404).render("404", { title: "Not Found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render("500", { title: "Server Error", error: err });
  });

  await ensureSeedData();

  app.listen(PORT, () => {
    console.log(`Food Point POS running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
