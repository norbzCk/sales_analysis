const API = "http://127.0.0.1:8000/customers/";
const table = document.getElementById("customerTable");
const form = document.getElementById("customerForm");

function appendCustomer(c) {
  table.innerHTML += `
    <tr>
      <td>${c.name}</td>
      <td>${c.email}</td>
    </tr>
  `;
}

async function loadCustomers() {
  const res = await fetch(API);
  const data = await res.json();
  table.innerHTML = "";
  data.forEach(appendCustomer);
}

form.addEventListener("submit", async e => {
  e.preventDefault();

  const customer = {
    name: name.value,
    email: email.value
  };

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer)
  });

  if (!res.ok) return alert("Failed");

  appendCustomer(await res.json());
  form.reset();
});

loadCustomers();
