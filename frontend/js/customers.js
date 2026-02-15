const API = "http://127.0.0.1:8000/customers/";
const table = document.getElementById("customerTable");
const form = document.getElementById("customerForm");
const flash = document.getElementById("customerFlash");

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => flash.className = "flash", 2500);
}

function row(customer) {
  return `
    <tr>
      <td>${customer.name ?? "-"}</td>
      <td>${customer.email ?? "-"}</td>
      <td>${customer.phone ?? "-"}</td>
      <td>${customer.location ?? "-"}</td>
    </tr>
  `;
}

async function loadCustomers() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("Failed loading customers");
    const data = await res.json();
    if (!data.length) {
      table.innerHTML = `<tr><td class="empty" colspan="4">No customers yet</td></tr>`;
      return;
    }
    table.innerHTML = data.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="4">Failed to load customers</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim() || null,
    phone: document.getElementById("phone").value.trim() || null,
    location: document.getElementById("location").value.trim() || null,
  };

  if (!payload.name) {
    showFlash("error", "Name is required.");
    return;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Save failed");
    form.reset();
    showFlash("success", "Customer saved.");
    loadCustomers();
  } catch (err) {
    console.error(err);
    showFlash("error", "Unable to save customer.");
  }
});

loadCustomers();
