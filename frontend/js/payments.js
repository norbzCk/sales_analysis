const paymentsTable = document.getElementById("paymentsTable");

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function statusFromOrder(order) {
  const base = Number(order.id || 0) % 3;
  if (base === 2) return "Pending";
  return "Paid";
}

function row(order) {
  const paymentStatus = statusFromOrder(order);
  return `
    <tr>
      <td>#${order.id}</td>
      <td>${order.order_date ?? "-"}</td>
      <td>${order.product ?? "-"}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="badge">${paymentStatus}</span></td>
    </tr>
  `;
}

async function loadPayments() {
  const data = await apiFetch("/orders/");
  const orders = Array.isArray(data) ? data : [];

  const total = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paidAmount = orders.reduce((sum, o) => sum + (statusFromOrder(o) === "Paid" ? Number(o.total || 0) : 0), 0);
  const paidOrders = orders.filter((o) => statusFromOrder(o) === "Paid").length;
  const balance = Math.max(0, total - paidAmount);

  document.getElementById("payTotalValue").textContent = formatMoney(total);
  document.getElementById("payPaidAmount").textContent = formatMoney(paidAmount);
  document.getElementById("payBalance").textContent = formatMoney(balance);
  document.getElementById("payPaidOrders").textContent = String(paidOrders);

  if (!orders.length) {
    paymentsTable.innerHTML = '<tr><td class="empty" colspan="5">No payment history yet</td></tr>';
    return;
  }

  paymentsTable.innerHTML = orders.map(row).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user) return;
  if (user.role !== "user") {
    redirectToPostLogin(user);
    return;
  }

  try {
    await loadPayments();
  } catch (err) {
    paymentsTable.innerHTML = `<tr><td class="empty" colspan="5">${err.message}</td></tr>`;
  }
});
