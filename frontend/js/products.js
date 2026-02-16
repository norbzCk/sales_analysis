const grid = document.getElementById("product-list");
const form = document.getElementById("productForm");
const flash = document.getElementById("productFlash");
const roleHint = document.getElementById("productRoleHint");
const productView = document.getElementById("productViewContent");
const searchInput = document.getElementById("productSearch");
const sortSelect = document.getElementById("productSort");
const refreshBtn = document.getElementById("refreshProducts");
const cartCountBadge = document.getElementById("cartCountBadge");

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

let currentUser = null;
let allProducts = [];

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => {
    flash.className = "flash";
  }, 2600);
}

function cartKey() {
  return currentUser ? `cart_count_${currentUser.id}` : "cart_count_guest";
}

function readCartCount() {
  return Number(localStorage.getItem(cartKey()) || 0);
}

function writeCartCount(value) {
  localStorage.setItem(cartKey(), String(value));
  cartCountBadge.textContent = `Cart: ${value}`;
}

function updateCartBadge() {
  writeCartCount(readCartCount());
}

function productRating(product) {
  const seed = Number(product.id || 1);
  return (4 + ((seed * 7) % 10) / 10).toFixed(1);
}

function soldCount(product) {
  const seed = Number(product.id || 1);
  return 40 + (seed * 17) % 600;
}

function canManage() {
  return currentUser && (currentUser.role === "admin" || currentUser.role === "super_admin");
}

function canOrder() {
  return currentUser && currentUser.role === "user";
}

function card(product) {
  const outOfStock = Number(product.stock || 0) <= 0;
  const rating = productRating(product);
  const sold = soldCount(product);

  return `
    <article class="product-card reveal-item" data-product-id="${product.id}">
      <div class="product-media-wrap">
        <img class="product-media" src="${escapeHtml(product.image_url || FALLBACK_IMAGE)}" alt="${escapeHtml(product.name || "Product image")}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        <span class="badge product-category">${escapeHtml(product.category || "General")}</span>
      </div>
      <div class="product-body">
        <h3 class="product-name">${escapeHtml(product.name || "Unnamed product")}</h3>
        <p class="product-desc">${escapeHtml(product.description || "No description available")}</p>

        <div class="product-meta">
          <span class="rating-stars">${"★".repeat(4)}☆</span>
          <span class="muted">${rating} | ${sold}+ sold</span>
        </div>

        <div class="product-row">
          <p class="product-price">${formatMoney(product.price)}</p>
          <p class="stock ${outOfStock ? "out" : "in"}">${outOfStock ? "Out of stock" : `Stock: ${product.stock}`}</p>
        </div>

        <div class="product-actions">
          <button class="btn btn-secondary" onclick="viewProduct(${product.id})">View</button>
          ${canManage() ? `<button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>` : ""}
          ${canOrder() ? `<button class="btn btn-secondary" ${outOfStock ? "disabled" : ""} onclick="addToCart(${product.id})">Add to Cart</button>` : ""}
          ${canOrder() ? `<button class="btn btn-primary" ${outOfStock ? "disabled" : ""} onclick="orderProduct(${product.id})">Buy Now</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function applyFilters(products) {
  const text = (searchInput?.value || "").trim().toLowerCase();
  const sort = sortSelect?.value || "featured";

  let filtered = products.filter((p) => {
    if (!text) return true;
    const hay = `${p.name || ""} ${p.category || ""}`.toLowerCase();
    return hay.includes(text);
  });

  if (sort === "price_low") {
    filtered = filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === "price_high") {
    filtered = filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === "stock_high") {
    filtered = filtered.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
  } else {
    filtered = filtered.sort((a, b) => (Number(a.id || 0) - Number(b.id || 0)));
  }

  return filtered;
}

function renderProducts() {
  const items = applyFilters(allProducts);
  if (!items.length) {
    grid.innerHTML = `<div class="empty">No products found for this filter.</div>`;
    return;
  }

  grid.innerHTML = items.map(card).join("");

  const cards = [...grid.querySelectorAll(".reveal-item")];
  cards.forEach((el, idx) => {
    setTimeout(() => el.classList.add("is-visible"), 70 * idx);
  });
}

async function fetchProducts() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  try {
    const products = await apiFetch("/products/");
    allProducts = Array.isArray(products) ? products : [];
    renderProducts();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

async function viewProduct(id) {
  try {
    const product = await apiFetch(`/products/${id}`);
    productView.innerHTML = `
      <div class="product-view-panel">
        <img src="${escapeHtml(product.image_url || FALLBACK_IMAGE)}" alt="${escapeHtml(product.name)}" class="product-view-image" onerror="this.src='${FALLBACK_IMAGE}'">
        <div>
          <p><strong>Name:</strong> ${escapeHtml(product.name || "-")}</p>
          <p><strong>Category:</strong> ${escapeHtml(product.category || "-")}</p>
          <p><strong>Unit Price:</strong> ${formatMoney(product.price)}</p>
          <p><strong>Available Stock:</strong> ${product.stock ?? 0}</p>
          <p><strong>Description:</strong> ${escapeHtml(product.description || "-")}</p>
          <p><strong>Image URL:</strong> ${escapeHtml(product.image_url || "-")}</p>
        </div>
      </div>
    `;
  } catch (err) {
    productView.textContent = err.message;
  }
}

function addToCart() {
  const next = readCartCount() + 1;
  writeCartCount(next);
  showFlash("success", "Item added to cart.");
}

async function orderProduct(id) {
  const rawQty = prompt("Enter quantity to order:", "1");
  if (rawQty === null) return;
  const qty = parseInt(rawQty, 10);
  if (Number.isNaN(qty) || qty <= 0) {
    showFlash("error", "Please enter a valid quantity.");
    return;
  }

  try {
    await apiFetch("/orders/", {
      method: "POST",
      body: JSON.stringify({
        product_id: id,
        quantity: qty,
        order_date: new Date().toISOString().slice(0, 10),
      }),
    });
    showFlash("success", "Order placed successfully.");
    fetchProducts();
  } catch (err) {
    showFlash("error", err.message);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value, 10),
    description: document.getElementById("description").value.trim(),
    image_url: document.getElementById("image_url").value.trim() || null,
  };

  if (!payload.name || !payload.category || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
    showFlash("error", "Fill all required product fields.");
    return;
  }

  try {
    await apiFetch("/products/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    showFlash("success", "Product saved successfully.");
    fetchProducts();
  } catch (err) {
    showFlash("error", err.message);
  }
});

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    showFlash("success", "Product deleted.");
    fetchProducts();
  } catch (err) {
    showFlash("error", err.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthPage();
  if (currentUser?.role === "user") {
    roleHint.textContent = "Customer mode: compare, add items to cart, then buy now.";
  } else if (currentUser?.role === "super_admin") {
    roleHint.textContent = "Owner mode: upload product details and image URLs to curate the catalog.";
  } else {
    roleHint.textContent = "Admin mode: maintain stock, pricing, and product content.";
  }

  updateCartBadge();
  fetchProducts();

  searchInput?.addEventListener("input", renderProducts);
  sortSelect?.addEventListener("change", renderProducts);
  refreshBtn?.addEventListener("click", fetchProducts);
});

window.deleteProduct = deleteProduct;
window.viewProduct = viewProduct;
window.orderProduct = orderProduct;
window.addToCart = addToCart;
