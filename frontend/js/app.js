const API = "http://127.0.0.1:8000";

let productChartInstance = null;
let timeChartInstance = null;

// ======================
// Utilities
// ======================
document.addEventListener("DOMContentLoaded", initDashboard);

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed`);
  return res.json();
}

function showTableError(msg) {
  console.error(msg);
  document.getElementById("recent-sales-body").innerHTML =
    "<tr><td colspan='5'>Failed to load data</td></tr>";
}

// ======================
// Init
// ======================
async function initDashboard() {
  try {
    await loadStats();
    await loadProductRevenue();
    await loadRevenueTime();
    await loadRecentSales();
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

// ======================
// Stats
// ======================
async function loadStats() {
  const data = await fetchJSON(`${API}/dashboard/stats`);

  document.getElementById("revenue").textContent =
    formatMoney(data.total_revenue);

  document.getElementById("orders").textContent =
    data.total_orders ?? 0;

  document.getElementById("units").textContent =
    data.total_units ?? 0;

  document.getElementById("top-product").textContent =
    data.top_product || "—";
}

// ======================
// Revenue by Product
// ======================
async function loadProductRevenue() {
  const data = await fetchJSON(`${API}/dashboard/revenue-product`);

  if (productChartInstance) productChartInstance.destroy();

  productChartInstance = new Chart(
    document.getElementById("productChart"),
    {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: "Revenue (TZS)",
          data: Object.values(data)
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    }
  );
}

// ======================
// Revenue Over Time
// ======================
async function loadRevenueTime() {
  const data = await fetchJSON(`${API}/dashboard/revenue-time`);

  if (timeChartInstance) timeChartInstance.destroy();

  timeChartInstance = new Chart(
    document.getElementById("timeChart"),
    {
      type: "line",
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: "Revenue (TZS)",
          data: Object.values(data),
          tension: 0.4
        }]
      },
      options: { responsive: true }
    }
  );
}

// ======================
// Recent Sales Table
// ======================
async function loadRecentSales() {
  try {
    const data = await fetchJSON(`${API}/dashboard/recent-sales`);
    const tbody = document.getElementById("recent-sales-body");

    if (!data.length) {
      tbody.innerHTML =
        "<tr><td colspan='5'>No recent sales</td></tr>";
      return;
    }

    tbody.innerHTML = data.map(sale => `
      <tr>
        <td>${sale.date}</td>
        <td>${sale.product}</td>
        <td>${sale.category}</td>
        <td>${sale.quantity}</td>
        <td>${formatMoney(sale.revenue)}</td>
      </tr>
    `).join("");

  } catch (err) {
    showTableError(err);
  }
}
