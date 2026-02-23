const ordersTable = document.getElementById("cdOrdersTable");
const notifications = document.getElementById("cdNotifications");

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function statusFromOrder(order) {
  const base = Number(order.id || 0) % 3;
  if (base === 0) return "Delivered";
  if (base === 1) return "Shipped";
  return "Pending";
}

function row(order) {
  const status = statusFromOrder(order);
  return `
    <tr>
      <td>#${order.id}</td>
      <td>${order.order_date ?? "-"}</td>
      <td>${order.product ?? "-"}</td>
      <td>${order.quantity ?? 0}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="badge">${status}</span></td>
    </tr>
  `;
}

function renderNotifications(orders) {
  if (!orders.length) {
    notifications.innerHTML = '<li class="muted">No notifications yet.</li>';
    return;
  }

  const lines = orders.slice(0, 3).map((order) => {
    const status = statusFromOrder(order);
    return `<li>Order #${order.id} is currently <strong>${status}</strong>.</li>`;
  });
  notifications.innerHTML = lines.join("");
}

async function loadDashboard() {
  const data = await apiFetch("/orders/");
  const orders = Array.isArray(data) ? data : [];

  const pending = orders.filter((o) => statusFromOrder(o) === "Pending").length;
  const delivered = orders.filter((o) => statusFromOrder(o) === "Delivered").length;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  document.getElementById("cdOrdersCount").textContent = String(orders.length);
  document.getElementById("cdPendingCount").textContent = String(pending);
  document.getElementById("cdDeliveredCount").textContent = String(delivered);
  document.getElementById("cdTotalSpent").textContent = formatMoney(totalSpent);

  if (!orders.length) {
    ordersTable.innerHTML = '<tr><td class="empty" colspan="6">No orders yet</td></tr>';
  } else {
    ordersTable.innerHTML = orders.slice(0, 6).map(row).join("");
  }

  renderNotifications(orders);
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user) return;
  if (user.role !== "user") {
    redirectToPostLogin(user);
    return;
  }

  try {
    await loadDashboard();
  } catch (err) {
    ordersTable.innerHTML = `<tr><td class="empty" colspan="6">${err.message}</td></tr>`;
  }
});
