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
    const data = await apiFetch("/customers/");
    if (!data.length) {
      table.innerHTML = `<tr><td class="empty" colspan="4">No customers yet</td></tr>`;
      return;
    }
    table.innerHTML = data.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="4">${err.message}</td></tr>`;
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
    await apiFetch("/customers/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    showFlash("success", "Customer saved.");
    loadCustomers();
  } catch (err) {
    showFlash("error", err.message);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await requireAuthPage();
  if (!currentUser || !["super_admin", "owner"].includes(currentUser.role)) {
    if (currentUser) {
      redirectToPostLogin(currentUser);
    } else {
      window.location.href = "login.html";
    }
    return;
  }
  loadCustomers();
});
