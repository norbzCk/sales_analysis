let productChartInstance = null;
let timeChartInstance = null;
let isRefreshing = false;
const statAnimationFrames = new Map();

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function emptyRow(message, colspan = 5) {
  return `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRevealBlocks() {
  return Array.from(document.querySelectorAll(".main .card"));
}

function setDashboardLoadingState(isLoading) {
  const container = document.getElementById("dashboardContent");
  if (!container) return;
  container.classList.remove("is-loading", "is-ready");
  container.classList.add(isLoading ? "is-loading" : "is-ready");
}

function resetRevealBlocks() {
  getRevealBlocks().forEach((el) => {
    el.classList.remove("show");
    el.classList.add("dash-reveal");
  });
}

function showRevealBlocksSlowly() {
  getRevealBlocks().forEach((el, idx) => {
    setTimeout(() => el.classList.add("show"), idx * 110);
  });
}

function animateCount(el, target, formatter, duration = 760) {
  if (!el) return;

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    el.textContent = formatter(target);
    return;
  }

  const key = el.id || String(Math.random());
  const existing = statAnimationFrames.get(key);
  if (existing) {
    cancelAnimationFrame(existing);
  }

  const start = performance.now();
  const from = 0;
  const diff = Math.max(0, Number(target || 0)) - from;

  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - p) ** 3;
    const value = from + diff * eased;
    el.textContent = formatter(value);
    if (p < 1) {
      statAnimationFrames.set(key, requestAnimationFrame(tick));
      return;
    }
    el.textContent = formatter(target);
    statAnimationFrames.delete(key);
  };

  statAnimationFrames.set(key, requestAnimationFrame(tick));
}

async function loadStats() {
  const data = await apiFetch("/dashboard/stats");
  const revenue = Number(data.total_revenue || 0);
  const orders = Number(data.total_orders || 0);
  const units = Number(data.total_units || 0);

  animateCount(document.getElementById("revenue"), revenue, (v) => formatMoney(v), 900);
  animateCount(document.getElementById("orders"), orders, (v) => String(Math.round(v)), 700);
  animateCount(document.getElementById("units"), units, (v) => String(Math.round(v)), 700);
  document.getElementById("top-product").textContent = data.top_product || "-";
}

async function loadProductRevenue() {
  const data = await apiFetch("/dashboard/revenue-product");
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
  const data = await apiFetch("/dashboard/revenue-time");
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
    const data = await apiFetch("/dashboard/recent-sales");
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
  if (isRefreshing) return;
  isRefreshing = true;

  const refreshBtn = document.getElementById("refreshDashboard");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }

  setDashboardLoadingState(true);
  resetRevealBlocks();
  await delay(220);

  const results = await Promise.allSettled([
    loadStats(),
    loadProductRevenue(),
    loadRevenueTime(),
    loadRecentSales(),
  ]);

  showRevealBlocksSlowly();

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error("Some dashboard widgets failed to refresh", failed);
  }

  setDashboardLoadingState(false);
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
  isRefreshing = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("refreshDashboard")?.addEventListener("click", initDashboard);
  try {
    const currentUser = await requireAuthPage();
    if (!currentUser || currentUser.role === "user") {
      window.location.href = "customer-dashboard.html";
      return;
    }
    await initDashboard();
  } catch (err) {
    console.error("Dashboard failed", err);
  }
});
