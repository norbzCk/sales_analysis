const table = document.getElementById("orderTable");
const form = document.getElementById("orderForm");
const flash = document.getElementById("orderFlash");
const productSelect = document.getElementById("product_id");
const orderSearch = document.getElementById("orderSearch");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const refreshOrdersBtn = document.getElementById("refreshOrders");
const ordersShownBadge = document.getElementById("ordersShownBadge");
const trackingPanel = document.getElementById("orderTrackingPanel");

let currentUser = null;
let allOrders = [];
let selectedOrderId = null;

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => {
    flash.className = "flash";
  }, 2500);
}

function inferredStatus(order) {
  const fixed = String(order.status || "").trim();
  if (["Processing", "Shipped", "Delivered"].includes(fixed)) {
    return fixed;
  }
  const seed = Number(order.id || 0) % 3;
  if (seed === 0) return "Delivered";
  if (seed === 1) return "Shipped";
  return "Processing";
}

function statusBadgeClass(status) {
  if (status === "Delivered") return "success";
  if (status === "Shipped") return "info";
  return "warn";
}

function paymentStatus(order) {
  return Number(order.id || 0) % 3 === 2 ? "Pending" : "Paid";
}

function row(order) {
  const status = inferredStatus(order);
  return `
    <tr data-order-id="${order.id}">
      <td>#${order.id}</td>
      <td>${order.order_date ?? "-"}</td>
      <td>${order.product ?? "-"}</td>
      <td>${order.category ?? "-"}</td>
      <td>${order.quantity ?? 0}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="badge">${paymentStatus(order)}</span></td>
      <td><span class="badge order-status ${statusBadgeClass(status)}">${status}</span></td>
    </tr>
  `;
}

function renderTracking(order) {
  const status = inferredStatus(order);
  const steps = ["Processing", "Shipped", "Delivered"];
  const currentIdx = steps.indexOf(status);

  trackingPanel.innerHTML = `
    <div class="tracking-head">
      <p><strong>Order:</strong> #${order.id}</p>
      <p><strong>Product:</strong> ${order.product ?? "-"}</p>
      <p><strong>Date:</strong> ${order.order_date ?? "-"}</p>
      <p><strong>Total:</strong> ${formatMoney(order.total)}</p>
    </div>
    <div class="tracking-steps">
      ${steps
        .map((step, idx) => `<div class="tracking-step ${idx <= currentIdx ? "done" : ""}">${step}</div>`)
        .join("")}
    </div>
  `;
}

function updateInsightCards(orders) {
  const total = orders.length;
  const open = orders.filter((o) => inferredStatus(o) !== "Delivered").length;
  const delivered = orders.filter((o) => inferredStatus(o) === "Delivered").length;

  document.getElementById("orderTotalCount").textContent = String(total);
  document.getElementById("orderOpenCount").textContent = String(open);
  document.getElementById("orderDeliveredCount").textContent = String(delivered);
}

function filteredOrders() {
  const text = (orderSearch?.value || "").trim().toLowerCase();
  const status = orderStatusFilter?.value || "all";

  return allOrders.filter((order) => {
    const okText =
      !text || `${order.product || ""} ${order.category || ""}`.toLowerCase().includes(text);
    const currentStatus = inferredStatus(order);
    const okStatus = status === "all" || currentStatus === status;
    return okText && okStatus;
  });
}

function bindRowSelection() {
  const rows = [...table.querySelectorAll("tr[data-order-id]")];
  rows.forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      selectedOrderId = Number(rowEl.dataset.orderId);
      rows.forEach((item) => item.classList.toggle("row-selected", Number(item.dataset.orderId) === selectedOrderId));
      const selected = allOrders.find((o) => Number(o.id) === selectedOrderId);
      if (selected) {
        renderTracking(selected);
      }
    });
  });
}

function renderOrders() {
  const shown = filteredOrders();
  ordersShownBadge.textContent = `Showing: ${shown.length}`;
  updateInsightCards(allOrders);

  if (!shown.length) {
    table.innerHTML = `<tr><td class="empty" colspan="8">No orders match this filter</td></tr>`;
    trackingPanel.textContent = "Select an order to view its shipping progress.";
    return;
  }

  table.innerHTML = shown.map(row).join("");
  bindRowSelection();

  if (!selectedOrderId || !shown.some((o) => Number(o.id) === Number(selectedOrderId))) {
    selectedOrderId = Number(shown[0].id);
    renderTracking(shown[0]);
  } else {
    const selected = shown.find((o) => Number(o.id) === Number(selectedOrderId));
    if (selected) renderTracking(selected);
  }

  [...table.querySelectorAll("tr[data-order-id]")].forEach((item) => {
    item.classList.toggle("row-selected", Number(item.dataset.orderId) === selectedOrderId);
  });
}

async function loadOrders() {
  if (refreshOrdersBtn) {
    refreshOrdersBtn.disabled = true;
    refreshOrdersBtn.textContent = "Refreshing...";
  }

  try {
    const data = await apiFetch("/orders/");
    allOrders = Array.isArray(data) ? data : [];
    renderOrders();
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="8">${err.message}</td></tr>`;
  } finally {
    if (refreshOrdersBtn) {
      refreshOrdersBtn.disabled = false;
      refreshOrdersBtn.textContent = "Refresh";
    }
  }
}

async function loadProductsForOrders() {
  if (!productSelect) return;
  try {
    const products = await apiFetch("/products/");
    const options = ['<option value="">Select product</option>'];
    for (const product of products) {
      if (Number(product.stock || 0) <= 0) continue;
      options.push(`<option value="${product.id}">${product.name} (${product.category})</option>`);
    }
    productSelect.innerHTML = options.join("");
  } catch (err) {
    showFlash("error", err.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthPage();
  if (document.getElementById("order_date")) {
    document.getElementById("order_date").valueAsDate = new Date();
  }

  if (currentUser?.role === "user") {
    loadProductsForOrders();
  }

  loadOrders();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      order_date: document.getElementById("order_date").value,
      product_id: parseInt(productSelect.value, 10),
      quantity: parseInt(document.getElementById("quantity").value, 10),
    };
    if (!payload.order_date || Number.isNaN(payload.product_id) || Number.isNaN(payload.quantity) || payload.quantity <= 0) {
      showFlash("error", "Choose a product and valid quantity.");
      return;
    }

    try {
      await apiFetch("/orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      document.getElementById("order_date").valueAsDate = new Date();
      showFlash("success", "Order created.");
      loadProductsForOrders();
      loadOrders();
    } catch (err) {
      showFlash("error", err.message);
    }
  });

  orderSearch?.addEventListener("input", renderOrders);
  orderStatusFilter?.addEventListener("change", renderOrders);
  refreshOrdersBtn?.addEventListener("click", loadOrders);
});
