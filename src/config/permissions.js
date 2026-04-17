const PERMISSIONS = [
  { key: "pos.access", label: "POS terminal", group: "POS" },
  { key: "pos.sale", label: "Complete sales", group: "POS" },
  { key: "pos.hold", label: "Hold / resume orders", group: "POS" },
  { key: "products.manage", label: "Manage products", group: "Catalog" },
  { key: "categories.manage", label: "Manage categories", group: "Catalog" },
  { key: "orders.view", label: "View orders", group: "Orders" },
  { key: "orders.cancel", label: "Cancel orders", group: "Orders" },
  { key: "reports.view", label: "View reports", group: "Reports" },
  { key: "users.manage", label: "Manage users", group: "Admin" },
];

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const DEFAULT_CASHIER_PERMISSIONS = [
  "pos.access",
  "pos.sale",
  "pos.hold",
  "orders.view",
];

function hasPermission(user, perm) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "admin") return true;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  DEFAULT_CASHIER_PERMISSIONS,
  hasPermission,
};
