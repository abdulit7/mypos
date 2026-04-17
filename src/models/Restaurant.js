const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    ownerName: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    taxRate: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "Rs" },
    maxUsers: { type: Number, default: 5, min: 1 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

RestaurantSchema.virtual("isExpired").get(function isExpired() {
  return !!(this.expiresAt && this.expiresAt.getTime() < Date.now());
});

RestaurantSchema.set("toJSON", { virtuals: true });
RestaurantSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
