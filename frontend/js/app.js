const API = "http://127.0.0.1:8000";

// ---------- Helpers ----------
function formatMoney(value) {
  return `$${Number(value).toLocaleString()}`;
}

function showError(msg) {
  console.error(msg);
  alert("Failed to load dashboard data");
}

// ---------- STATS ----------
fetch(`${API}/dashboard/stats`)
  .then(res => {
    if (!res.ok) throw new Error("Stats API error");
    return res.json();
  })
  .then(data => {
    document.getElementById("revenue").innerText =
      formatMoney(data.total_revenue);

    document.getElementById("orders").innerText =
      data.total_orders;

    document.getElementById("units").innerText =
      data.total_units;

    document.getElementById("top-product").innerText =
      data.top_product || "—";
  })
  .catch(showError);

// ---------- REVENUE BY PRODUCT ----------
fetch(`${API}/dashboard/revenue-product`)
  .then(res => {
    if (!res.ok) throw new Error("Product revenue API error");
    return res.json();
  })
  .then(data => {
    new Chart(document.getElementById("productChart"), {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: "Revenue",
          data: Object.values(data),
          backgroundColor: "#3b82f6"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        }
      }
    });
  })
  .catch(showError);

// ---------- REVENUE OVER TIME ----------
fetch(`${API}/dashboard/revenue-time`)
  .then(res => {
    if (!res.ok) throw new Error("Revenue time API error");
    return res.json();
  })
  .then(data => {
    new Chart(document.getElementById("timeChart"), {
      type: "line",
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: "Revenue",
          data: Object.values(data),
          borderColor: "#22c55e",
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true
      }
    });
  })
  .catch(showError);

  fetch(`${API}/dashboard/recent-sales`)
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById("recent-sales-body");
    tbody.innerHTML = "";

    if (data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5'>No recent sales</td></tr>";
      return;
    }

    data.forEach(sale => {
      tbody.innerHTML += `
        <tr>
          <td>${sale.date}</td>
          <td>${sale.product}</td>
          <td>${sale.category}</td>
          <td>${sale.quantity}</td>
          <td>$${sale.revenue}</td>
        </tr>
      `;
    });
  })
  .catch(() => {
    document.getElementById("recent-sales-body").innerHTML =
      "<tr><td colspan='5'>Failed to load data</td></tr>";
  });
