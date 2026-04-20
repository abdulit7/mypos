const express = require("express");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { requirePermission } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

function parseCart(body) {
  const rawItems = Array.isArray(body.items)
    ? body.items
    : JSON.parse(body.items || "[]");
  const items = rawItems.map((it) => {
    const price = Number(it.price) || 0;
    const quantity = Math.max(1, Number(it.quantity) || 1);
    return {
      product: it.product || null,
      name: it.name,
      price,
      quantity,
      subtotal: +(price * quantity).toFixed(2),
    };
  });
  const subtotal = +items.reduce((s, it) => s + it.subtotal, 0).toFixed(2);
  const taxRate = Number(body.taxRate) || 0;
  const taxAmount = +((subtotal * taxRate) / 100).toFixed(2);
  const discount = Number(body.discount) || 0;
  const total = +(subtotal + taxAmount - discount).toFixed(2);
  return { items, subtotal, taxRate, taxAmount, discount, total };
}

router.get("/", requirePermission("pos.access"), async (req, res) => {
  const scope = { restaurant: req.tenant._id };
  const [categories, products, heldOrders] = await Promise.all([
    Category.find({ ...scope, active: true }).sort({ name: 1 }).lean(),
    Product.find({ ...scope, active: true })
      .populate("category")
      .sort({ name: 1 })
      .lean(),
    Order.find({ ...scope, status: "held" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);
  let loadedHeld = null;
  if (req.query.load) {
    loadedHeld = await Order.findOne({ _id: req.query.load, ...scope }).lean();
  }
  res.locals.tenant = req.tenant;
  res.render("pos/index", {
    title: "Point of Sale",
    categories,
    products,
    heldOrders,
    loadedHeld,
  });
});

router.post("/sale", requirePermission("pos.sale"), async (req, res) => {
  try {
    const cart = parseCart(req.body);
    if (!cart.items.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }
    const paid = Number(req.body.paid) || cart.total;
    const change = Math.max(0, +(paid - cart.total).toFixed(2));

    let order;
    if (req.body.fromHeldId) {
      order = await Order.findOne({
        _id: req.body.fromHeldId,
        restaurant: req.tenant._id,
      });
      if (!order) return res.status(404).json({ error: "Held order not found" });
      Object.assign(order, cart, {
        paid,
        change,
        paymentMethod: req.body.paymentMethod || "cash",
        orderType: req.body.orderType || "dine-in",
        tableNo: req.body.tableNo || "",
        customerName: req.body.customerName || "",
        customerPhone: req.body.customerPhone || "",
        note: req.body.note || "",
        status: "completed",
        invoiceNo: undefined,
        cashier: req.user?._id,
      });
      await order.save();
    } else {
      order = await Order.create({
        ...cart,
        restaurant: req.tenant._id,
        paid,
        change,
        paymentMethod: req.body.paymentMethod || "cash",
        orderType: req.body.orderType || "dine-in",
        tableNo: req.body.tableNo || "",
        customerName: req.body.customerName || "",
        customerPhone: req.body.customerPhone || "",
        note: req.body.note || "",
        status: "completed",
        cashier: req.user?._id,
      });
    }

    res.json({
      ok: true,
      orderId: order._id,
      invoiceNo: order.invoiceNo,
      printUrl: `/r/${req.tenantSlug}/orders/${order._id}/print`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/hold", requirePermission("pos.hold"), async (req, res) => {
  try {
    const cart = parseCart(req.body);
    if (!cart.items.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }
    let order;
    if (req.body.fromHeldId) {
      order = await Order.findOne({
        _id: req.body.fromHeldId,
        restaurant: req.tenant._id,
      });
      if (!order) return res.status(404).json({ error: "Held order not found" });
      Object.assign(order, cart, {
        paymentMethod: req.body.paymentMethod || "cash",
        orderType: req.body.orderType || "dine-in",
        tableNo: req.body.tableNo || "",
        customerName: req.body.customerName || "",
        customerPhone: req.body.customerPhone || "",
        note: req.body.note || "",
        status: "held",
        cashier: req.user?._id,
      });
      await order.save();
    } else {
      order = await Order.create({
        ...cart,
        restaurant: req.tenant._id,
        paymentMethod: req.body.paymentMethod || "cash",
        orderType: req.body.orderType || "dine-in",
        tableNo: req.body.tableNo || "",
        customerName: req.body.customerName || "",
        customerPhone: req.body.customerPhone || "",
        note: req.body.note || "",
        status: "held",
        cashier: req.user?._id,
      });
    }
    res.json({ ok: true, heldId: order._id, invoiceNo: order.invoiceNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
