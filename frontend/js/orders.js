const table = document.getElementById("orderTable");
const form = document.getElementById("orderForm");
const flash = document.getElementById("orderFlash");
const productSelect = document.getElementById("product_id");
let currentUser = null;

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => flash.className = "flash", 2500);
}

function row(order) {
  return `
    <tr>
      <td>${order.order_date ?? "-"}</td>
      <td>${order.product ?? "-"}</td>
      <td>${order.category ?? "-"}</td>
      <td>${order.quantity ?? 0}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="badge">${order.status ?? "Completed"}</span></td>
      <td>${order.created_by ?? "-"}</td>
    </tr>
  `;
}

async function loadOrders() {
  try {
    const data = await apiFetch("/orders/");
    if (!data.length) {
      table.innerHTML = `<tr><td class="empty" colspan="7">No orders yet</td></tr>`;
      return;
    }
    table.innerHTML = data.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="7">${err.message}</td></tr>`;
  }
}

async function loadProductsForOrders() {
  if (!productSelect) return;
  try {
    const products = await apiFetch("/products/");
    const options = ['<option value="">Select product</option>'];
    for (const product of products) {
      if (Number(product.stock || 0) <= 0) continue;
      options.push(`<option value="${product.id}">${product.name} (${product.category}) - Stock: ${product.stock}</option>`);
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
});
