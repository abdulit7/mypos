# Food Point POS

A point-of-sale system for a food point (BBQ, Biryani, Karahi, Fast Food, Drinks,
Desserts and more) built with **Node.js, Express, EJS, Mongoose, and
TailwindCSS**.

## Features

- **Login / Roles** — admin and cashier users (sessions stored in MongoDB).
- **Categories** — BBQ, Biryani, Karahi, Fast Food, Drinks, Desserts (manageable
  from the UI).
- **Products** — create / edit / delete products with price, cost, SKU,
  description and image upload.
- **POS Terminal** — category tabs, quick search, click-to-add, edit
  quantities, tax %, discount, multiple payment methods, change calculation.
- **Order Types** — dine-in (with table #), takeaway, delivery; optional
  customer name & phone.
- **Hold / Resume Orders** — park an order, resume it later from the POS or
  Orders page.
- **Order Search** — filter by invoice #, customer, phone, item name, table
  number, status, or date range.
- **POS Invoice Printing** — 80 mm thermal-receipt view that auto-prints on
  sale.
- **Sales Report** — summary, by category, top products and daily breakdown;
  printable + **PDF export** (Node equivalent of Crystal Reports — Crystal is a
  Windows/.NET tool that doesn't run in Node).
- Styled with **TailwindCSS**.

## Getting started

```bash
# 1. Install deps
npm install

# 2. Build Tailwind once (or use `npm run watch:css` during development)
npm run build:css

# 3. Copy env and edit as needed
cp .env.example .env

# 4a. Option A: run against a local/cloud MongoDB (MONGO_URI in .env)
npm start

# 4b. Option B: run with no MongoDB installed (spins up an in-memory server)
USE_MEMORY_DB=true npm start
```

Then open http://localhost:3000 and sign in:

- **admin** / `admin123` — can manage catalog, run POS, view reports.
- **cashier** / `cashier123` — can run POS, view orders & reports.

Default categories and a starter menu (BBQ, Biryani, Karahi, Fast Food, Drinks,
Desserts) are seeded on first run.

## Project structure

```
server.js                # app bootstrap
src/
  config/db.js           # Mongoose connection (real or in-memory)
  config/seed.js         # default users / categories / products
  models/                # User, Category, Product, Order
  middleware/auth.js     # session auth + role guards
  routes/                # auth, dashboard, categories, products, pos, orders, reports
views/                   # EJS views + layouts
public/                  # built Tailwind CSS + client JS + uploaded images
```

## Sale flow

1. Open **POS** → pick a category tab, tap items to add to the cart.
2. Set order type (dine-in / takeaway / delivery), table #, customer, tax %,
   discount, payment method, and amount paid.
3. **Hold** — saves the order as `HLD-YYYYMMDD-####` and lets you start a new
   one. Resume from the right rail or from `Orders → Held`.
4. **Pay & Print** — stores the order as `INV-YYYYMMDD-####` and opens the
   printable thermal receipt in a new window.

## Reports

- `/reports` — filter by date range, see totals, by-category, top products, and
  daily breakdown. Print-friendly, and `Export PDF` gives you a downloadable
  PDF via PDFKit.

## A note on Crystal Reports

Crystal Reports is a Windows/.NET reporting tool and does not run on Node.js.
This project implements the standard Node equivalent: a filterable HTML report
that prints cleanly and can be exported to PDF — functionally equivalent to the
Crystal sales report you'd typically attach to a POS.
