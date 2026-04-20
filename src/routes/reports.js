const express = require("express");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Order = require("../models/Order");
const { requirePermission } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

function resolveDateRange(query) {
  const now = new Date();
  let from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  let to = query.to ? new Date(query.to) : new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function buildSalesReport(query, restaurantId) {
  const { from, to } = resolveDateRange(query);

  const match = {
    restaurant: new mongoose.Types.ObjectId(restaurantId),
    status: "completed",
    createdAt: { $gte: from, $lte: to },
  };

  const [summary, byDay, byCategory, topProducts, orders] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          gross: { $sum: "$subtotal" },
          tax: { $sum: "$taxAmount" },
          discount: { $sum: "$discount" },
          total: { $sum: "$total" },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          orders: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "p.category",
          foreignField: "_id",
          as: "c",
        },
      },
      { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$c.name", "Uncategorized"] },
          quantity: { $sum: "$items.quantity" },
          total: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          total: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    Order.find(match).sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  return {
    from,
    to,
    summary: summary[0] || { orders: 0, gross: 0, tax: 0, discount: 0, total: 0 },
    byDay,
    byCategory,
    topProducts,
    orders,
  };
}

router.get("/", requirePermission("reports.view"), async (req, res) => {
  const report = await buildSalesReport(req.query, req.tenant._id);
  res.render("reports/sales", {
    title: "Sales Report",
    report,
    q: {
      from: req.query.from || "",
      to: req.query.to || "",
    },
  });
});

router.get("/sales.pdf", requirePermission("reports.view"), async (req, res) => {
  const report = await buildSalesReport(req.query, req.tenant._id);
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="sales-report-${report.from.toISOString().slice(0, 10)}-to-${report.to
      .toISOString()
      .slice(0, 10)}.pdf"`
  );
  doc.pipe(res);

  const title = req.tenant?.name
    ? `${req.tenant.name} — Sales Report`
    : "Sales Report";
  doc.fontSize(20).text(title, { align: "center" });
  doc
    .moveDown(0.2)
    .fontSize(11)
    .fillColor("#555")
    .text(
      `Period: ${report.from.toISOString().slice(0, 10)}  →  ${report.to
        .toISOString()
        .slice(0, 10)}`,
      { align: "center" }
    );
  doc.moveDown().fillColor("black");

  // Summary
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.3).fontSize(11);
  const s = report.summary;
  doc.text(`Orders: ${s.orders}`);
  doc.text(`Gross Sales: ${s.gross.toFixed(2)}`);
  doc.text(`Tax Collected: ${s.tax.toFixed(2)}`);
  doc.text(`Discounts: ${s.discount.toFixed(2)}`);
  doc.text(`Net Total: ${s.total.toFixed(2)}`);
  doc.moveDown();

  // By Category
  doc.fontSize(14).text("Sales by Category", { underline: true });
  doc.moveDown(0.3).fontSize(11);
  if (!report.byCategory.length) doc.text("No data.");
  report.byCategory.forEach((c) => {
    doc.text(`${c._id}: qty ${c.quantity}, total ${c.total.toFixed(2)}`);
  });
  doc.moveDown();

  // Top Products
  doc.fontSize(14).text("Top Products", { underline: true });
  doc.moveDown(0.3).fontSize(11);
  if (!report.topProducts.length) doc.text("No data.");
  report.topProducts.forEach((p, i) => {
    doc.text(`${i + 1}. ${p._id} — qty ${p.quantity}, total ${p.total.toFixed(2)}`);
  });
  doc.moveDown();

  // Daily
  doc.fontSize(14).text("Daily Breakdown", { underline: true });
  doc.moveDown(0.3).fontSize(11);
  if (!report.byDay.length) doc.text("No data.");
  report.byDay.forEach((d) => {
    doc.text(`${d._id}: ${d.orders} orders, total ${d.total.toFixed(2)}`);
  });

  doc.end();
});

module.exports = router;
