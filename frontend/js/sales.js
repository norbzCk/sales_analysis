const API = "http://127.0.0.1:8000/sales/";
const table = document.getElementById("salesTable");

function appendSale(s) {
  table.innerHTML += `
    <tr>
      <td>${s.date}</td>
      <td>${s.product}</td>
      <td>TZS ${s.revenue}</td>
    </tr>
  `;
}

async function loadSales() {
  const res = await fetch(API);
  const data = await res.json();
  table.innerHTML = "";
  data.forEach(appendSale);
}

loadSales();
