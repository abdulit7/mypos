(function () {
  const state = {
    cart: [],
    fromHeldId: null,
  };
  const BASE = (window.__POS__ && window.__POS__.base) || "";
  const api = (path) => BASE + path;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function formatMoney(n) {
    return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  }

  function recalc() {
    const subtotal = state.cart.reduce((s, it) => s + it.price * it.quantity, 0);
    const taxRate = Number($("#taxRate").value) || 0;
    const discount = Number($("#discount").value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = Math.max(0, subtotal + taxAmount - discount);
    $("#sumSubtotal").textContent = formatMoney(subtotal);
    $("#sumTax").textContent = formatMoney(taxAmount);
    $("#sumDiscount").textContent = formatMoney(discount);
    $("#sumTotal").textContent = formatMoney(total);

    const paid = Number($("#paid").value) || 0;
    $("#changeVal").textContent = "Rs " + formatMoney(Math.max(0, paid - total));
    renderCart();
  }

  function renderCart() {
    const list = $("#cartList");
    list.innerHTML = "";
    if (!state.cart.length) {
      const empty = document.createElement("div");
      empty.id = "cartEmpty";
      empty.className = "text-sm text-gray-500 py-6 text-center";
      empty.textContent = "Cart is empty. Tap items to add.";
      list.appendChild(empty);
      return;
    }
    state.cart.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "py-2 flex items-center gap-2";
      row.innerHTML = `
        <div class="flex-1">
          <div class="font-semibold text-sm">${it.name}</div>
          <div class="text-xs text-gray-500">Rs ${formatMoney(it.price)} each</div>
        </div>
        <div class="flex items-center gap-1">
          <button data-idx="${idx}" data-action="dec" class="w-6 h-6 rounded bg-gray-200">-</button>
          <input data-idx="${idx}" data-action="qty" value="${it.quantity}" class="w-10 text-center border rounded py-0.5" />
          <button data-idx="${idx}" data-action="inc" class="w-6 h-6 rounded bg-gray-200">+</button>
        </div>
        <div class="w-20 text-right text-sm font-semibold">Rs ${formatMoney(it.price * it.quantity)}</div>
        <button data-idx="${idx}" data-action="del" class="text-red-600 hover:text-red-800">✕</button>
      `;
      list.appendChild(row);
    });
  }

  $("#cartList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const action = btn.dataset.action;
    if (!Number.isInteger(idx)) return;
    if (action === "inc") state.cart[idx].quantity += 1;
    if (action === "dec") state.cart[idx].quantity = Math.max(1, state.cart[idx].quantity - 1);
    if (action === "del") state.cart.splice(idx, 1);
    recalc();
  });

  $("#cartList").addEventListener("change", (e) => {
    if (e.target.dataset.action !== "qty") return;
    const idx = Number(e.target.dataset.idx);
    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
    state.cart[idx].quantity = v;
    recalc();
  });

  function addToCart(p) {
    const existing = state.cart.find((i) => i.product === p.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({
        product: p.id,
        name: p.name,
        price: Number(p.price),
        quantity: 1,
      });
    }
    recalc();
  }

  $$(".product-card").forEach((el) => {
    el.addEventListener("click", () => {
      addToCart({
        id: el.dataset.id,
        name: el.dataset.name,
        price: el.dataset.price,
      });
    });
  });

  $$(".cat-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".cat-tab").forEach((t) => {
        t.classList.remove("bg-brand-600", "text-white");
        t.classList.add("bg-gray-200", "text-gray-700");
      });
      tab.classList.add("bg-brand-600", "text-white");
      tab.classList.remove("bg-gray-200", "text-gray-700");
      const cat = tab.dataset.cat;
      $$(".product-card").forEach((card) => {
        card.style.display = cat === "all" || card.dataset.cat === cat ? "" : "none";
      });
    });
  });

  $("#productSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$(".product-card").forEach((card) => {
      const name = card.dataset.name.toLowerCase();
      const sku = (card.dataset.sku || "").toLowerCase();
      card.style.display = !q || name.includes(q) || sku.includes(q) ? "" : "none";
    });
  });

  ["taxRate", "discount", "paid"].forEach((id) => {
    $("#" + id).addEventListener("input", recalc);
  });

  $("#clearCart").addEventListener("click", () => {
    if (!state.cart.length) return;
    if (!confirm("Clear current order?")) return;
    state.cart = [];
    state.fromHeldId = null;
    recalc();
  });

  function buildPayload() {
    return {
      items: JSON.stringify(state.cart),
      taxRate: Number($("#taxRate").value) || 0,
      discount: Number($("#discount").value) || 0,
      paid: Number($("#paid").value) || 0,
      paymentMethod: $("#paymentMethod").value,
      orderType: $("#orderType").value,
      tableNo: $("#tableNo").value,
      customerName: $("#customerName").value,
      customerPhone: $("#customerPhone").value,
      note: $("#note").value,
      fromHeldId: state.fromHeldId || "",
    };
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  $("#payBtn").addEventListener("click", async () => {
    if (!state.cart.length) return alert("Add at least one item.");
    const total = Number($("#sumTotal").textContent);
    const paidField = $("#paid");
    if (!Number(paidField.value)) paidField.value = total.toFixed(2);
    recalc();
    try {
      const data = await postJson(api("/pos/sale"), buildPayload());
      // Open invoice in new window for printing
      window.open(data.printUrl, "_blank", "width=420,height=700");
      state.cart = [];
      state.fromHeldId = null;
      recalc();
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      alert("Sale failed: " + err.message);
    }
  });

  $("#holdBtn").addEventListener("click", async () => {
    if (!state.cart.length) return alert("Add at least one item.");
    try {
      const data = await postJson(api("/pos/hold"), buildPayload());
      alert("Order held as " + data.invoiceNo);
      state.cart = [];
      state.fromHeldId = null;
      recalc();
      window.location.href = api("/pos");
    } catch (err) {
      alert("Hold failed: " + err.message);
    }
  });

  // Load held order if present
  const loaded = window.__POS__ && window.__POS__.loadedHeld;
  if (loaded) {
    state.fromHeldId = loaded._id;
    state.cart = (loaded.items || []).map((it) => ({
      product: it.product,
      name: it.name,
      price: Number(it.price),
      quantity: Number(it.quantity),
    }));
    $("#taxRate").value = loaded.taxRate || 0;
    $("#discount").value = loaded.discount || 0;
    $("#orderType").value = loaded.orderType || "dine-in";
    $("#tableNo").value = loaded.tableNo || "";
    $("#customerName").value = loaded.customerName || "";
    $("#customerPhone").value = loaded.customerPhone || "";
    $("#note").value = loaded.note || "";
  }

  recalc();
})();
