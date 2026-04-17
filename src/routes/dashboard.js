const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");

const router = express.Router();

router.get("/", async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayAgg, weekAgg, totalOrders, heldOrders, productCount, categoryCount, recentOrders] =
    await Promise.all([
      Order.aggregate([
        { $match: { status: "completed", createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, sales: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
          },
        },
        { $group: { _id: null, sales: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ status: "completed" }),
      Order.countDocuments({ status: "held" }),
      Product.countDocuments({ active: true }),
      Category.countDocuments({ active: true }),
      Order.find({ status: "completed" }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

  res.render("dashboard/index", {
    title: "Dashboard",
    stats: {
      todaySales: todayAgg[0]?.sales || 0,
      todayOrders: todayAgg[0]?.count || 0,
      weekSales: weekAgg[0]?.sales || 0,
      weekOrders: weekAgg[0]?.count || 0,
      totalOrders,
      heldOrders,
      productCount,
      categoryCount,
    },
    recentOrders,
  });
});

module.exports = router;
