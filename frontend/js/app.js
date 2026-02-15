const API = "http://127.0.0.1:8000";

let productChartInstance = null;
let timeChartInstance = null;

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`${url} failed: ${message}`);
  }
  return res.json();
}

function emptyRow(message, colspan = 5) {
  return `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
}

async function loadStats() {
  const data = await fetchJSON(`${API}/dashboard/stats`);
  document.getElementById("revenue").textContent = formatMoney(data.total_revenue);
  document.getElementById("orders").textContent = data.total_orders ?? 0;
  document.getElementById("units").textContent = data.total_units ?? 0;
  document.getElementById("top-product").textContent = data.top_product || "-";
}

async function loadProductRevenue() {
  const data = await fetchJSON(`${API}/dashboard/revenue-product`);
  if (productChartInstance) productChartInstance.destroy();

  productChartInstance = new Chart(document.getElementById("productChart"), {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Revenue (TZS)",
        data: Object.values(data),
        backgroundColor: "#0f766e"
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

async function loadRevenueTime() {
  const data = await fetchJSON(`${API}/dashboard/revenue-time`);
  if (timeChartInstance) timeChartInstance.destroy();

  timeChartInstance = new Chart(document.getElementById("timeChart"), {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Revenue (TZS)",
        data: Object.values(data),
        borderColor: "#f97316",
        backgroundColor: "rgba(249, 115, 22, 0.18)",
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

async function loadRecentSales() {
  const tbody = document.getElementById("recent-sales-body");
  try {
    const data = await fetchJSON(`${API}/dashboard/recent-sales`);
    if (!data.length) {
      tbody.innerHTML = emptyRow("No recent sales yet");
      return;
    }

    tbody.innerHTML = data.map(sale => `
      <tr>
        <td>${sale.date ?? "-"}</td>
        <td>${sale.product ?? "-"}</td>
        <td>${sale.category ?? "-"}</td>
        <td>${sale.quantity ?? 0}</td>
        <td>${formatMoney(sale.revenue)}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = emptyRow("Failed to load recent sales");
  }
}

async function initDashboard() {
  try {
    await Promise.all([
      loadStats(),
      loadProductRevenue(),
      loadRevenueTime(),
      loadRecentSales(),
    ]);
  } catch (err) {
    console.error("Dashboard failed", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  document.getElementById("refreshDashboard")?.addEventListener("click", initDashboard);
});
