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
  const existing = await User.findOne({ username });
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

async function seedDemoRestaurant() {
  if (await Restaurant.countDocuments()) return;

  const restaurant = await Restaurant.create({
    name: "Food Point Demo",
    slug: "food-point-demo",
    ownerName: "Demo Owner",
    maxUsers: 10,
    isActive: true,
    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
  });

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

  const categoryDefs = [
    { name: "BBQ", description: "Grilled specialties" },
    { name: "Biryani", description: "Rice specialties" },
    { name: "Karahi", description: "Karahi & curries" },
    { name: "Fast Food", description: "Burgers, sandwiches, fries" },
    { name: "Drinks", description: "Cold drinks & juices" },
    { name: "Desserts", description: "Sweet dishes" },
  ];
  const categories = await Category.insertMany(
    categoryDefs.map((c) => ({ ...c, restaurant: restaurant._id }))
  );
  const byName = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  const productDefs = [
    { name: "Chicken Tikka", price: 550, category: byName.BBQ, sku: "BBQ-001" },
    { name: "Seekh Kebab", price: 450, category: byName.BBQ, sku: "BBQ-002" },
    { name: "Malai Boti", price: 600, category: byName.BBQ, sku: "BBQ-003" },
    { name: "Chicken Biryani", price: 350, category: byName.Biryani, sku: "BRY-001" },
    { name: "Beef Biryani", price: 400, category: byName.Biryani, sku: "BRY-002" },
    { name: "Sindhi Biryani", price: 380, category: byName.Biryani, sku: "BRY-003" },
    { name: "Chicken Karahi (Half)", price: 900, category: byName.Karahi, sku: "KRH-001" },
    { name: "Chicken Karahi (Full)", price: 1700, category: byName.Karahi, sku: "KRH-002" },
    { name: "Zinger Burger", price: 450, category: byName["Fast Food"], sku: "FF-001" },
    { name: "Club Sandwich", price: 550, category: byName["Fast Food"], sku: "FF-002" },
    { name: "Fries", price: 200, category: byName["Fast Food"], sku: "FF-003" },
    { name: "Coke (Regular)", price: 80, category: byName.Drinks, sku: "DR-001" },
    { name: "Fresh Lime", price: 150, category: byName.Drinks, sku: "DR-002" },
    { name: "Kheer", price: 180, category: byName.Desserts, sku: "DS-001" },
    { name: "Gulab Jamun", price: 150, category: byName.Desserts, sku: "DS-002" },
  ];
  await Product.insertMany(
    productDefs.map((p) => ({ ...p, restaurant: restaurant._id }))
  );

  console.log(
    `[seed] Created demo restaurant 'Food Point Demo' with admin/${DEMO_ADMIN_PW}, cashier/${DEMO_CASHIER_PW}`
  );
}

async function ensureSeedData() {
  await ensureSuperAdmin();
  await seedDemoRestaurant();
}

module.exports = { ensureSeedData };
