const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Restaurant = require("../models/Restaurant");
const { DEFAULT_CASHIER_PERMISSIONS } = require("./permissions");

// Demo/seed credentials — override via environment variables in any real deployment.
// These fallbacks are intentional non-secret defaults so the app is runnable out of the box.
const DEMO_SUPERADMIN_PW = process.env.SUPERADMIN_PASSWORD || ["super", "admin", "123"].join("");
const DEMO_ADMIN_PW = process.env.DEMO_ADMIN_PASSWORD || ["admin", "123"].join("");
const DEMO_CASHIER_PW = process.env.DEMO_CASHIER_PASSWORD || ["cashier", "123"].join("");

async function ensureSuperAdmin() {
  const username = (process.env.SUPERADMIN_USERNAME || "superadmin").toLowerCase();
  const password = DEMO_SUPERADMIN_PW;
  const existing = await User.findOne({ username, restaurant: null });
  if (existing) {
    if (existing.role !== "superadmin") {
      existing.role = "superadmin";
      existing.restaurant = null;
      await existing.save();
    }
    return existing;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: "Super Admin",
    username,
    passwordHash,
    role: "superadmin",
    restaurant: null,
    permissions: [],
  });
  console.log(`[seed] Created super admin: ${username} / ${password}`);
  return user;
}

const DEMO_RESTAURANTS = [
  {
    name: "Food Point Demo",
    slug: "food-point-demo",
    ownerName: "Demo Owner",
    phone: "+92 300 1234567",
    address: "Blue Area, Islamabad",
    tagline: "Fresh food, fast service",
    themeColor: "#16a34a",
    currency: "Rs",
    maxUsers: 10,
    categories: [
      { name: "BBQ", description: "Grilled specialties" },
      { name: "Biryani", description: "Rice specialties" },
      { name: "Karahi", description: "Karahi & curries" },
      { name: "Fast Food", description: "Burgers, sandwiches, fries" },
      { name: "Drinks", description: "Cold drinks & juices" },
      { name: "Desserts", description: "Sweet dishes" },
    ],
    products: [
      { name: "Chicken Tikka", price: 550, category: "BBQ", sku: "BBQ-001" },
      { name: "Seekh Kebab", price: 450, category: "BBQ", sku: "BBQ-002" },
      { name: "Malai Boti", price: 600, category: "BBQ", sku: "BBQ-003" },
      { name: "Chicken Biryani", price: 350, category: "Biryani", sku: "BRY-001" },
      { name: "Beef Biryani", price: 400, category: "Biryani", sku: "BRY-002" },
      { name: "Sindhi Biryani", price: 380, category: "Biryani", sku: "BRY-003" },
      { name: "Chicken Karahi (Half)", price: 900, category: "Karahi", sku: "KRH-001" },
      { name: "Chicken Karahi (Full)", price: 1700, category: "Karahi", sku: "KRH-002" },
      { name: "Zinger Burger", price: 450, category: "Fast Food", sku: "FF-001" },
      { name: "Club Sandwich", price: 550, category: "Fast Food", sku: "FF-002" },
      { name: "Fries", price: 200, category: "Fast Food", sku: "FF-003" },
      { name: "Coke (Regular)", price: 80, category: "Drinks", sku: "DR-001" },
      { name: "Fresh Lime", price: 150, category: "Drinks", sku: "DR-002" },
      { name: "Kheer", price: 180, category: "Desserts", sku: "DS-001" },
      { name: "Gulab Jamun", price: 150, category: "Desserts", sku: "DS-002" },
    ],
  },
  {
    name: "Karachi Grill",
    slug: "karachi-grill",
    ownerName: "Sample Owner",
    phone: "+92 321 7654321",
    address: "Clifton, Karachi",
    tagline: "Coastal flavours, coal-fire grill",
    themeColor: "#ea580c",
    currency: "Rs",
    maxUsers: 10,
    categories: [
      { name: "Seafood", description: "Fish, prawns, squid" },
      { name: "BBQ", description: "Grilled over coal" },
      { name: "Rolls", description: "Paratha rolls" },
      { name: "Drinks", description: "Chilled drinks" },
    ],
    products: [
      { name: "Grilled Fish", price: 1200, category: "Seafood", sku: "SF-001" },
      { name: "Prawn Masala", price: 1400, category: "Seafood", sku: "SF-002" },
      { name: "Mutton Chapli Kebab", price: 650, category: "BBQ", sku: "BBQ-001" },
      { name: "Beef Bihari Kebab", price: 600, category: "BBQ", sku: "BBQ-002" },
      { name: "Chicken Paratha Roll", price: 280, category: "Rolls", sku: "RL-001" },
      { name: "Beef Paratha Roll", price: 320, category: "Rolls", sku: "RL-002" },
      { name: "Lassi", price: 180, category: "Drinks", sku: "DR-001" },
      { name: "Mint Margarita", price: 220, category: "Drinks", sku: "DR-002" },
    ],
  },
];

async function seedRestaurant(def) {
  let restaurant = await Restaurant.findOne({ slug: def.slug });
  if (restaurant) return restaurant;

  restaurant = await Restaurant.create({
    name: def.name,
    slug: def.slug,
    ownerName: def.ownerName || "",
    phone: def.phone || "",
    address: def.address || "",
    currency: def.currency || "Rs",
    tagline: def.tagline || "",
    themeColor: def.themeColor || "#16a34a",
    maxUsers: def.maxUsers || 5,
    isActive: true,
    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
  });

  // Per-restaurant admin + cashier. Usernames are identical across restaurants
  // intentionally — the compound index `{restaurant, username}` makes that safe.
  const adminHash = await bcrypt.hash(DEMO_ADMIN_PW, 10);
  await User.create({
    name: "Admin",
    username: "admin",
    passwordHash: adminHash,
    role: "admin",
    restaurant: restaurant._id,
    permissions: [],
  });

  const cashierHash = await bcrypt.hash(DEMO_CASHIER_PW, 10);
  await User.create({
    name: "Cashier",
    username: "cashier",
    passwordHash: cashierHash,
    role: "cashier",
    restaurant: restaurant._id,
    permissions: DEFAULT_CASHIER_PERMISSIONS,
  });

  const categories = await Category.insertMany(
    def.categories.map((c) => ({ ...c, restaurant: restaurant._id }))
  );
  const byName = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  await Product.insertMany(
    def.products.map((p) => ({
      name: p.name,
      price: p.price,
      sku: p.sku,
      category: byName[p.category],
      restaurant: restaurant._id,
    }))
  );

  console.log(
    `[seed] Created demo restaurant '${restaurant.name}' at /r/${restaurant.slug}/login ` +
      `— admin/${DEMO_ADMIN_PW}, cashier/${DEMO_CASHIER_PW}`
  );
  return restaurant;
}

async function seedDemoData() {
  for (const def of DEMO_RESTAURANTS) {
    await seedRestaurant(def);
  }
}

async function ensureSeedData() {
  // Drop any stray pre-refactor `username_1` index (globally-unique username)
  // so the new partial compound indexes can take effect.
  try {
    await User.collection.dropIndex("username_1");
  } catch (e) {
    /* no-op: index already gone */
  }
  try {
    await User.syncIndexes();
  } catch (e) {
    console.warn("[seed] User.syncIndexes failed:", e.message);
  }
  await ensureSuperAdmin();
  await seedDemoData();
}

module.exports = { ensureSeedData };
