const API = "http://127.0.0.1:8000";

async function loadStats() {
  try {
    const res = await fetch(`${API}/dashboard/stats`);
    const data = await res.json();

    document.getElementById("stats").innerHTML = `
      <h3>Total Revenue: TZS ${data.total_revenue}</h3>
      <p>Total Orders: ${data.total_orders}</p>
      <p>Units Sold: ${data.total_units}</p>
      <p>Top Product: ${data.top_product}</p>
    `;
  } catch {
    document.getElementById("stats").innerText = "Failed to load stats";
  }
}

async function loadRevenueByProduct() {
  const res = await fetch(`${API}/dashboard/revenue-product`);
  const data = await res.json();

  new Chart(document.getElementById("productChart"), {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Revenue by Product",
        data: Object.values(data)
      }]
    }
  });
}

async function loadRevenueOverTime() {
  const res = await fetch(`${API}/dashboard/revenue-time`);
  const data = await res.json();

  new Chart(document.getElementById("timeChart"), {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Revenue Over Time",
        data: Object.values(data)
      }]
    }
  });
}

loadStats();
loadRevenueByProduct();
loadRevenueOverTime();
