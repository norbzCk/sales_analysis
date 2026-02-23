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
let selectedProductId = null;

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveImageUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${window.API_BASE}${raw}`;
  return `${window.API_BASE}/${raw.replace(/^\/+/, "")}`;
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

function stockLabel(stock) {
  const units = Number(stock || 0);
  if (units <= 0) return "Out of stock";
  if (canManage()) {
    if (units < 5) return `Only ${units} left`;
    return `In stock: ${units}`;
  }
  return "In stock";
}

function renderStars(ratingValue) {
  const rating = Number(ratingValue || 0);
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return `${"★".repeat(full)}${half ? "☆" : ""}${"✩".repeat(empty)}`;
}

function card(product) {
  const stock = Number(product.stock || 0);
  const outOfStock = stock <= 0;
  const rating = productRating(product);
  const sold = soldCount(product);
  const imageUrl = resolveImageUrl(product.image_url);

  return `
    <article class="product-card reveal-item" data-product-id="${product.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(product.name || "product")} details">
      <div class="product-media-wrap">
        <img class="product-media" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Product image")}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        <span class="badge product-category">${escapeHtml(product.category || "General")}</span>
      </div>
      <div class="product-body">
        <h3 class="product-name">${escapeHtml(product.name || "Unnamed product")}</h3>
        <p class="product-desc">${escapeHtml(product.description || "No description available")}</p>

        <div class="product-meta">
          <span class="rating-stars" title="Rating">${renderStars(rating)}</span>
          <span class="muted">${rating} rating</span>
          <span class="muted">${sold}+ sold</span>
        </div>

        <div class="product-row">
          <p class="product-price">${formatMoney(product.price)}</p>
          <p class="stock ${outOfStock ? "out" : "in"}">${stockLabel(stock)}</p>
        </div>

        <div class="product-actions" onclick="event.stopPropagation()">
          <button class="btn btn-secondary" onclick="viewProduct(${product.id})">Quick View</button>
          ${canManage() ? `<button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>` : ""}
          ${canOrder() ? `<button class="btn btn-secondary" ${outOfStock ? "disabled" : ""} onclick="addToCart()">Add to Cart</button>` : ""}
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
    filtered = filtered.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  }

  return filtered;
}

function bindCardEvents() {
  const cards = [...grid.querySelectorAll(".product-card")];
  cards.forEach((el, idx) => {
    setTimeout(() => el.classList.add("is-visible"), 55 * idx);
    el.addEventListener("click", () => viewProduct(Number(el.dataset.productId)));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        viewProduct(Number(el.dataset.productId));
      }
    });
  });
}

function updateCatalogHint(visibleCount) {
  const total = allProducts.length;
  roleHint.textContent = `${visibleCount} of ${total} products shown.`;
}

function renderProducts() {
  const items = applyFilters(allProducts);
  if (!items.length) {
    updateCatalogHint(0);
    grid.innerHTML = `<div class="empty">No products found for this filter.</div>`;
    return;
  }

  grid.innerHTML = items.map(card).join("");
  updateCatalogHint(items.length);
  bindCardEvents();

  if (selectedProductId && items.some((p) => Number(p.id) === Number(selectedProductId))) {
    const selectedCard = grid.querySelector(`[data-product-id="${selectedProductId}"]`);
    selectedCard?.classList.add("selected");
  }
}

function findProduct(productId) {
  return allProducts.find((item) => Number(item.id) === Number(productId)) || null;
}

function renderProductView(product) {
  const rating = productRating(product);
  const sold = soldCount(product);
  const imageUrl = resolveImageUrl(product.image_url);

  productView.innerHTML = `
    <div class="product-view-panel">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Product")}" class="product-view-image" onerror="this.src='${FALLBACK_IMAGE}'">
      <div>
        <h3 class="product-view-name">${escapeHtml(product.name || "Unnamed product")}</h3>
        <p class="product-view-price">${formatMoney(product.price)}</p>
        <div class="product-meta">
          <span class="rating-stars">${renderStars(rating)}</span>
          <span class="muted">${rating} rating</span>
          <span class="muted">${sold}+ sold</span>
        </div>
        <p class="product-view-line"><strong>Category:</strong> ${escapeHtml(product.category || "-")}</p>
        <p class="product-view-line"><strong>Availability:</strong> ${stockLabel(product.stock)}</p>
        <p class="product-view-description">${escapeHtml(product.description || "No description available for this item.")}</p>
      </div>
    </div>
  `;
}

async function fetchProducts() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  try {
    const products = await apiFetch("/products/");
    allProducts = Array.isArray(products) ? products : [];
    renderProducts();

    if (!selectedProductId && allProducts.length) {
      viewProduct(allProducts[0].id);
    }
  } catch (err) {
    console.error(err);
    roleHint.textContent = "Catalog unavailable right now.";
    grid.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

async function viewProduct(id) {
  try {
    const cached = findProduct(id);
    const product = cached || await apiFetch(`/products/${id}`);
    selectedProductId = Number(product.id);
    renderProductView(product);

    [...grid.querySelectorAll(".product-card")].forEach((el) => {
      el.classList.toggle("selected", Number(el.dataset.productId) === selectedProductId);
    });
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

async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  const response = await fetch(`${window.API_BASE}/products/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let detail = "Image upload failed";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch (_err) {
      const text = await response.text();
      detail = text || detail;
    }
    throw new Error(detail);
  }

  const data = await response.json();
  return data.image_url || null;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const fileInput = document.getElementById("image_file");
    const selectedFile = fileInput?.files?.[0] || null;
    let imageUrl = null;

    if (selectedFile) {
      imageUrl = await uploadProductImage(selectedFile);
    }

    const payload = {
      name: document.getElementById("name").value.trim(),
      category: document.getElementById("category").value.trim(),
      price: parseFloat(document.getElementById("price").value),
      stock: parseInt(document.getElementById("stock").value, 10),
      description: document.getElementById("description").value.trim(),
      image_url: imageUrl,
    };

    if (!payload.name || !payload.category || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
      showFlash("error", "Fill all required product fields.");
      return;
    }

    await apiFetch("/products/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    form.reset();
    showFlash("success", "Product saved successfully.");
    fetchProducts();
  } catch (err) {
    showFlash("error", err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Product";
  }
});

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    showFlash("success", "Product deleted.");

    if (Number(selectedProductId) === Number(id)) {
      selectedProductId = null;
      productView.textContent = "Choose any product card to preview details here.";
    }

    fetchProducts();
  } catch (err) {
    showFlash("error", err.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthPage();
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
