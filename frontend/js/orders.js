const API = "http://127.0.0.1:8000/orders/";
const table = document.getElementById("orderTable");

function appendOrder(o) {
  table.innerHTML += `
    <tr>
      <td>${o.customer_id}</td>
      <td>${o.product_id}</td>
      <td>${o.quantity}</td>
    </tr>
  `;
}

async function loadOrders() {
  const res = await fetch(API);
  const data = await res.json();
  table.innerHTML = "";
  data.forEach(appendOrder);
}

orderForm.addEventListener("submit", async e => {
  e.preventDefault();

  const order = {
    customer_id: customer_id.value,
    product_id: product_id.value,
    quantity: quantity.value
  };

  const res = await fetch(API, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(order)
  });

  if (!res.ok) return alert("Order failed");

  appendOrder(await res.json());
  orderForm.reset();
});

loadOrders();
