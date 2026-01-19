const API = "http://127.0.0.1:8000";

fetch(`${API}/dashboard/stats`)
  .then(res => res.json())
  .then(data => {
    document.getElementById("revenue").innerText =
      `Total Revenue\n$${data.total_revenue}`;

    document.getElementById("orders").innerText =
      `Total Orders\n${data.total_orders}`;

    document.getElementById("units").innerText =
      `Units Sold\n${data.total_units}`;

    document.getElementById("top-product").innerText =
      `Top Product\n${data.top_product}`;
  });

fetch(`${API}/dashboard/revenue-product`)
  .then(res => res.json())
  .then(data => {
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
  });

fetch(`${API}/dashboard/revenue-time`)
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById("timeChart"), {
      type: "line",
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: "Revenue Over Time",
          data: Object.values(data),
          fill: false
        }]
      }
    });
  });

