const table = document.getElementById("orderTable");
const form = document.getElementById("orderForm");
const flash = document.getElementById("orderFlash");
const productSelect = document.getElementById("product_id");
const orderSearch = document.getElementById("orderSearch");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const refreshOrdersBtn = document.getElementById("refreshOrders");
const ordersShownBadge = document.getElementById("ordersShownBadge");
const trackingPanel = document.getElementById("orderTrackingPanel");

const TRACKING_STEPS = ["Pending", "Confirmed", "Shipped", "Delivered"];

let currentUser = null;
let allOrders = [];
let selectedOrderId = null;

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => {
    flash.className = "flash";
  }, 2500);
}

function isAdmin() {
  return currentUser?.role === "admin" || currentUser?.role === "super_admin";
}

function normalizedStatus(order) {
  const value = String(order.status || "").trim();
  if (["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"].includes(value)) {
    return value;
  }
  return "Delivered";
}

function statusBadgeClass(status) {
  if (status === "Delivered") return "success";
  if (status === "Shipped") return "info";
  if (status === "Cancelled") return "danger";
  return "warn";
}

function ratingLabel(order) {
  const rating = Number(order.rating || 0);
  if (!rating) return "-";
  return `${"★".repeat(rating)}${"✩".repeat(5 - rating)}`;
}

function row(order) {
  const status = normalizedStatus(order);
  return `
    <tr data-order-id="${order.id}">
      <td>#${order.id}</td>
      <td>${order.order_date ?? "-"}</td>
      <td>${escapeHtml(order.product ?? "-")}</td>
      <td>${escapeHtml(order.category ?? "-")}</td>
      <td>${order.quantity ?? 0}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="badge order-status ${statusBadgeClass(status)}">${status}</span></td>
      <td>${ratingLabel(order)}</td>
    </tr>
  `;
}

function adminActionButtons(order) {
  const status = normalizedStatus(order);
  const controls = [];

  if (status === "Pending") {
    controls.push('<button class="btn btn-primary" data-set-status="Confirmed" type="button">Confirm Order</button>');
    controls.push('<button class="btn btn-danger" data-set-status="Cancelled" type="button">Cancel Order</button>');
  }
  if (status === "Confirmed") {
    controls.push('<button class="btn btn-primary" data-set-status="Shipped" type="button">Mark Shipped</button>');
    controls.push('<button class="btn btn-danger" data-set-status="Cancelled" type="button">Cancel Order</button>');
  }
  if (status === "Shipped") {
    controls.push('<button class="btn btn-primary" data-set-status="Delivered" type="button">Mark Delivered</button>');
  }

  if (!controls.length) return '<p class="muted">No admin actions for this stage.</p>';
  return `<div class="tracking-actions">${controls.join("")}</div>`;
}

function customerActionControls(order) {
  const status = normalizedStatus(order);
  const controls = [];

  if (["Pending", "Confirmed"].includes(status)) {
    controls.push('<button class="btn btn-danger" id="cancelOrderBtn" type="button">Cancel Order</button>');
  }

  if (status === "Delivered" && !order.rating) {
    controls.push(`
      <div class="rating-actions">
        <select id="ratingValue" title="Rate this order">
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Bad</option>
        </select>
        <button class="btn btn-primary" id="submitRatingBtn" type="button">Submit Rating</button>
      </div>
    `);
  }

  if (order.rating) {
    controls.push(`<p class="muted">Your rating: ${ratingLabel(order)}</p>`);
  }

  if (!controls.length) return '<p class="muted">No customer actions available for this stage.</p>';
  return controls.join("");
}

function renderTracking(order) {
  const status = normalizedStatus(order);
  const currentIdx = TRACKING_STEPS.indexOf(status);

  trackingPanel.innerHTML = `
    <div class="tracking-head">
      <p><strong>Order:</strong> #${order.id}</p>
      <p><strong>Product:</strong> ${escapeHtml(order.product ?? "-")}</p>
      <p><strong>Date:</strong> ${order.order_date ?? "-"}</p>
      <p><strong>Total:</strong> ${formatMoney(order.total)}</p>
    </div>
    <div class="tracking-steps">
      ${TRACKING_STEPS
        .map((step, idx) => `<div class="tracking-step ${status !== "Cancelled" && idx <= currentIdx ? "done" : ""}">${step}</div>`)
        .join("")}
    </div>
    ${status === "Cancelled" ? '<p class="muted" style="margin-top: 12px;">This order was cancelled.</p>' : ""}
    <div class="tracking-controls">
      <h3 class="section-title" style="margin-top: 14px;">Actions</h3>
      ${isAdmin() ? adminActionButtons(order) : customerActionControls(order)}
    </div>
  `;

  if (isAdmin()) {
    trackingPanel.querySelectorAll("[data-set-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await updateOrderStatus(order.id, btn.dataset.setStatus);
      });
    });
  } else {
    const cancelBtn = document.getElementById("cancelOrderBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        if (!confirm("Cancel this order?")) return;
        await cancelOrder(order.id);
      });
    }

    const rateBtn = document.getElementById("submitRatingBtn");
    if (rateBtn) {
      rateBtn.addEventListener("click", async () => {
        const value = Number(document.getElementById("ratingValue")?.value || 0);
        await submitRating(order.id, value);
      });
    }
  }
}

function updateInsightCards(orders) {
  const total = orders.length;
  const open = orders.filter((o) => {
    const status = normalizedStatus(o);
    return status !== "Delivered" && status !== "Cancelled";
  }).length;
  const delivered = orders.filter((o) => normalizedStatus(o) === "Delivered").length;

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
    const currentStatus = normalizedStatus(order);
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
    table.innerHTML = `<tr><td class="empty" colspan="8">${escapeHtml(err.message)}</td></tr>`;
  } finally {
    if (refreshOrdersBtn) {
      refreshOrdersBtn.disabled = false;
      refreshOrdersBtn.textContent = "Refresh";
    }
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await apiFetch(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    selectedOrderId = Number(orderId);
    showFlash("success", `Order updated to ${status}.`);
    await loadOrders();
  } catch (err) {
    showFlash("error", err.message);
  }
}

async function cancelOrder(orderId) {
  try {
    await apiFetch(`/orders/${orderId}/cancel`, {
      method: "POST",
    });
    selectedOrderId = Number(orderId);
    showFlash("success", "Order cancelled.");
    await loadOrders();
    await loadProductsForOrders();
  } catch (err) {
    showFlash("error", err.message);
  }
}

async function submitRating(orderId, rating) {
  if (rating < 1 || rating > 5) {
    showFlash("error", "Choose a rating from 1 to 5.");
    return;
  }

  try {
    await apiFetch(`/orders/${orderId}/rating`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    });
    selectedOrderId = Number(orderId);
    showFlash("success", "Rating submitted.");
    await loadOrders();
  } catch (err) {
    showFlash("error", err.message);
  }
}

async function loadProductsForOrders() {
  if (!productSelect) return;
  try {
    const products = await apiFetch("/products/");
    const options = ['<option value="">Select product</option>'];
    for (const product of products) {
      if (Number(product.stock || 0) <= 0) continue;
      options.push(`<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.category)})</option>`);
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
    await loadProductsForOrders();
  }

  await loadOrders();

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
      const created = await apiFetch("/orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      document.getElementById("order_date").valueAsDate = new Date();
      selectedOrderId = Number(created?.id || selectedOrderId);
      showFlash("success", "Order created.");
      await loadProductsForOrders();
      await loadOrders();
    } catch (err) {
      showFlash("error", err.message);
    }
  });

  orderSearch?.addEventListener("input", renderOrders);
  orderStatusFilter?.addEventListener("change", renderOrders);
  refreshOrdersBtn?.addEventListener("click", loadOrders);
});
