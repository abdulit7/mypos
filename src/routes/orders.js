const express = require("express");
const Order = require("../models/Order");

const router = express.Router();

router.get("/", async (req, res) => {
  const { q, status, from, to } = req.query;
  const filter = {};
  if (status && ["held", "completed", "cancelled"].includes(status)) {
    filter.status = status;
  }
  if (q) {
    filter.$or = [
      { invoiceNo: new RegExp(q, "i") },
      { customerName: new RegExp(q, "i") },
      { customerPhone: new RegExp(q, "i") },
      { "items.name": new RegExp(q, "i") },
      { tableNo: new RegExp(q, "i") },
    ];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const orders = await Order.find(filter)
    .populate("cashier", "name username")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.render("orders/index", {
    title: "Orders",
    orders,
    q: q || "",
    status: status || "",
    from: from || "",
    to: to || "",
  });
});

router.get("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("cashier", "name username")
    .lean();
  if (!order) {
    req.flash("error", "Order not found.");
    return res.redirect("/orders");
  }
  res.render("orders/show", { title: `Order ${order.invoiceNo}`, order });
});

router.get("/:id/print", async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("cashier", "name username")
    .lean();
  if (!order) {
    return res.status(404).send("Order not found");
  }
  res.render("orders/print", {
    title: `Invoice ${order.invoiceNo}`,
    order,
    layout: "layouts/blank",
  });
});

router.post("/:id/cancel", async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { status: "cancelled" });
  req.flash("success", "Order cancelled.");
  res.redirect("back");
});

router.delete("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order && order.status === "held") {
    await Order.findByIdAndDelete(req.params.id);
    req.flash("success", "Held order removed.");
  } else {
    req.flash("error", "Only held orders can be deleted.");
  }
  res.redirect("back");
});

module.exports = router;
