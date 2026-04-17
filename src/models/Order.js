const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, index: true },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "online"],
      default: "cash",
    },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      default: "dine-in",
    },
    tableNo: { type: String, default: "" },
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    status: {
      type: String,
      enum: ["held", "completed", "cancelled"],
      default: "completed",
      index: true,
    },
    note: { type: String, default: "" },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

OrderSchema.index({ restaurant: 1, invoiceNo: 1 }, { unique: true });

OrderSchema.pre("validate", async function generateInvoiceNo(next) {
  if (this.invoiceNo) return next();
  try {
    const Order = this.constructor;
    const prefix = this.status === "held" ? "HLD" : "INV";
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const latest = await Order.findOne({
      restaurant: this.restaurant,
      invoiceNo: new RegExp(`^${prefix}-${datePart}-`),
    })
      .sort({ createdAt: -1 })
      .select("invoiceNo")
      .lean();
    let nextSeq = 1;
    if (latest && latest.invoiceNo) {
      const parts = latest.invoiceNo.split("-");
      const last = parseInt(parts[2], 10);
      if (!Number.isNaN(last)) nextSeq = last + 1;
    }
    this.invoiceNo = `${prefix}-${datePart}-${String(nextSeq).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Order", OrderSchema);
