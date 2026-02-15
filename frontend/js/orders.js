const API = "http://127.0.0.1:8000/orders/";
const table = document.getElementById("orderTable");
const form = document.getElementById("orderForm");
const flash = document.getElementById("orderFlash");

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
    </tr>
  `;
}

async function loadOrders() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("Failed loading orders");
    const data = await res.json();
    if (!data.length) {
      table.innerHTML = `<tr><td class="empty" colspan="6">No orders yet</td></tr>`;
      return;
    }
    table.innerHTML = data.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="6">Failed to load orders</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    order_date: document.getElementById("order_date").value,
    product: document.getElementById("product").value.trim(),
    category: document.getElementById("category").value.trim(),
    quantity: parseInt(document.getElementById("quantity").value, 10),
    unit_price: parseFloat(document.getElementById("unit_price").value),
  };

  if (!payload.order_date || !payload.product || !payload.category || Number.isNaN(payload.quantity) || Number.isNaN(payload.unit_price)) {
    showFlash("error", "Fill all order fields.");
    return;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Save failed");
    form.reset();
    showFlash("success", "Order created.");
    loadOrders();
  } catch (err) {
    console.error(err);
    showFlash("error", "Unable to create order.");
  }
});

document.getElementById("order_date").valueAsDate = new Date();
loadOrders();
