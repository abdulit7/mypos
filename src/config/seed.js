const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");

async function ensureSeedData() {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "Admin",
      username: "admin",
      passwordHash,
      role: "admin",
    });
    const cashierHash = await bcrypt.hash("cashier123", 10);
    await User.create({
      name: "Cashier",
      username: "cashier",
      passwordHash: cashierHash,
      role: "cashier",
    });
    console.log("[seed] Created default users: admin/admin123, cashier/cashier123");
  }

  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    const categories = await Category.insertMany([
      { name: "BBQ", description: "Grilled specialties" },
      { name: "Biryani", description: "Rice specialties" },
      { name: "Karahi", description: "Karahi & curries" },
      { name: "Fast Food", description: "Burgers, sandwiches, fries" },
      { name: "Drinks", description: "Cold drinks & juices" },
      { name: "Desserts", description: "Sweet dishes" },
    ]);

    const byName = Object.fromEntries(categories.map((c) => [c.name, c._id]));

    await Product.insertMany([
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
    ]);
    console.log("[seed] Created default categories & products");
  }
}

module.exports = { ensureSeedData };
