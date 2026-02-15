const API = "http://127.0.0.1:8000/products/";
const table = document.getElementById("product-list");
const form = document.getElementById("productForm");
const flash = document.getElementById("productFlash");

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => flash.className = "flash", 2500);
}

function row(product) {
  return `
    <tr>
      <td>${product.name ?? "-"}</td>
      <td>${product.category ?? "-"}</td>
      <td>${formatMoney(product.price)}</td>
      <td>${product.stock ?? 0}</td>
      <td>${product.description ?? "-"}</td>
      <td>
        <button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>
      </td>
    </tr>
  `;
}

async function fetchProducts() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("Could not load products");
    const products = await res.json();
    if (!products.length) {
      table.innerHTML = `<tr><td class="empty" colspan="6">No products found</td></tr>`;
      return;
    }
    table.innerHTML = products.map(row).join("");
  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td class="empty" colspan="6">Failed to load products</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value, 10),
    description: document.getElementById("description").value.trim(),
  };

  if (!payload.name || !payload.category || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
    showFlash("error", "Fill all required product fields.");
    return;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Product save failed");
    form.reset();
    showFlash("success", "Product saved successfully.");
    fetchProducts();
  } catch (err) {
    console.error(err);
    showFlash("error", "Unable to save product.");
  }
});

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    const res = await fetch(`${API}${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    showFlash("success", "Product deleted.");
    fetchProducts();
  } catch (err) {
    console.error(err);
    showFlash("error", "Unable to delete product.");
  }
}

fetchProducts();
