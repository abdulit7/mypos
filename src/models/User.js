const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Usernames are unique PER RESTAURANT, not globally. Two restaurants can
    // both have their own `admin` / `cashier` users without colliding. The
    // superadmin (restaurant:null) is kept unique by the second partial index
    // below.
    username: { type: String, required: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["superadmin", "admin", "cashier"],
      default: "cashier",
      index: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      index: true,
    },
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound unique: (restaurant, username) is unique within a restaurant.
// Partial filter limits this to users that actually belong to a restaurant.
UserSchema.index(
  { restaurant: 1, username: 1 },
  {
    unique: true,
    partialFilterExpression: { restaurant: { $type: "objectId" } },
    name: "restaurant_username_unique",
  }
);

// Unique across superadmins (restaurant:null) — at most one user with a given
// username AND no restaurant. Keeps the single superadmin slot clean.
UserSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: { restaurant: null },
    name: "superadmin_username_unique",
  }
);

module.exports = mongoose.model("User", UserSchema);
