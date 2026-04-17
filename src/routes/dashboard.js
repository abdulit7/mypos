const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");

const router = express.Router();

router.get("/", async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const scope = { restaurant: req.user.restaurant };

  const [todayAgg, weekAgg, totalOrders, heldOrders, productCount, categoryCount, recentOrders] =
    await Promise.all([
      Order.aggregate([
        { $match: { ...scope, status: "completed", createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, sales: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            ...scope,
            status: "completed",
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
          },
        },
        { $group: { _id: null, sales: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ ...scope, status: "completed" }),
      Order.countDocuments({ ...scope, status: "held" }),
      Product.countDocuments({ ...scope, active: true }),
      Category.countDocuments({ ...scope, active: true }),
      Order.find({ ...scope, status: "completed" })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
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
