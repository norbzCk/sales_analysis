const table = document.getElementById("salesTable");
const form = document.getElementById("saleForm");
const flash = document.getElementById("salesFlash");

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => flash.className = "flash", 2500);
}

function row(sale) {
  return `
    <tr>
      <td>${sale.date ?? "-"}</td>
      <td>${sale.product ?? "-"}</td>
      <td>${sale.category ?? "-"}</td>
      <td>${sale.quantity ?? 0}</td>
      <td>${formatMoney(sale.unit_price)}</td>
      <td>${formatMoney(sale.revenue)}</td>
    </tr>
  `;
}

async function loadSales() {
  try {
    const data = await apiFetch("/sales/");
    if (!data.length) {
      table.innerHTML = `<tr><td class="empty" colspan="6">No sales recorded yet</td></tr>`;
      return;
    }
    table.innerHTML = data.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="6">${err.message}</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    date: document.getElementById("sale_date").value,
    product: document.getElementById("sale_product").value.trim(),
    category: document.getElementById("sale_category").value.trim(),
    quantity: parseInt(document.getElementById("sale_quantity").value, 10),
    unit_price: parseFloat(document.getElementById("sale_unit_price").value),
  };

  if (!payload.date || !payload.product || !payload.category || Number.isNaN(payload.quantity) || Number.isNaN(payload.unit_price)) {
    showFlash("error", "Fill all sale fields.");
    return;
  }

  try {
    await apiFetch("/sales/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    document.getElementById("sale_date").valueAsDate = new Date();
    showFlash("success", "Sale saved.");
    loadSales();
  } catch (err) {
    showFlash("error", err.message);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await requireAuthPage();
  if (!currentUser || currentUser.role !== "super_admin") {
    if (currentUser) {
      redirectToPostLogin(currentUser);
    } else {
      window.location.href = "login.html";
    }
    return;
  }
  document.getElementById("sale_date").valueAsDate = new Date();
  loadSales();
});
