const grid = document.getElementById("product-list");
const form = document.getElementById("productForm");
const flash = document.getElementById("productFlash");
const roleHint = document.getElementById("productRoleHint");
const productView = document.getElementById("productViewContent");
const searchInput = document.getElementById("productSearch");
const sortSelect = document.getElementById("productSort");
const categorySelect = document.getElementById("productCategoryFilter");
const providerFilter = document.getElementById("productProviderFilter");
const refreshBtn = document.getElementById("refreshProducts");
const cartCountBadge = document.getElementById("cartCountBadge");
const providerSelect = document.getElementById("provider_id");

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

let currentUser = null;
let allProducts = [];
let selectedProductId = null;
let providers = [];

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
  return currentUser ? `cart_items_${currentUser.id}` : "cart_items_guest";
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(cartKey()) || "[]");
  } catch (e) {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(cartKey(), JSON.stringify(items));
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const items = getCart();
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById("cartBadgeCount");
  if (badge) badge.textContent = count;
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id == productId);
  if (!product) return;

  const items = getCart();
  const existing = items.find(i => i.id == productId);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      qty: 1
    });
  }
  saveCart(items);
  showFlash("success", `Added ${product.name} to temporary orders.`);
  document.getElementById("cartPopout").classList.add("show");
}

function removeFromCart(productId) {
  const items = getCart().filter(i => i.id != productId);
  saveCart(items);
}

function renderCart() {
  const list = document.getElementById("cartItemsList");
  const totalDisplay = document.getElementById("cartTotalDisplay");
  const items = getCart();
  
  if (!list || !totalDisplay) return;

  if (items.length === 0) {
    list.innerHTML = '<p class="muted" style="padding: 20px; text-align: center;">No temporary orders yet.</p>';
    totalDisplay.textContent = "TZS 0";
    return;
  }

  let total = 0;
  list.innerHTML = items.map(item => {
    total += item.price * item.qty;
    return `
      <div class="cart-item-row">
        <img src="${resolveImageUrl(item.image_url)}" class="cart-item-img">
        <div class="cart-item-info">
          <h4>${escapeHtml(item.name)}</h4>
          <p>${item.qty} x ${formatMoney(item.price)}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="removeFromCart(${item.id})">
          <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
        </button>
      </div>
    `;
  }).join("");

  totalDisplay.textContent = formatMoney(total);
}

async function checkoutCart() {
  const items = getCart();
  if (items.length === 0) return;

  const btn = document.getElementById("checkoutBtn");
  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    for (const item of items) {
      await apiFetch("/orders/", {
        method: "POST",
        body: JSON.stringify({
          product_id: item.id,
          quantity: item.qty,
          order_date: new Date().toISOString().slice(0, 10),
        }),
      });
    }
    saveCart([]);
    document.getElementById("cartPopout").classList.remove("show");
    showFlash("success", "All orders placed successfully! Go to Orders page to track them.");
    fetchProducts();
  } catch (err) {
    showFlash("error", "Checkout failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Make Order";
  }
}

function card(product) {
  const stock = Number(product.stock || 0);
  const outOfStock = stock <= 0;
  const rating = productRating(product);
  const imageUrl = resolveImageUrl(product.image_url);

  return `
    <article class="product-card reveal-item" data-product-id="${product.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(product.name || "product")} details">
      <div class="product-media-wrap">
        <img class="product-media" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Product image")}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        <span class="badge product-category">${escapeHtml(product.category || "General")}</span>
      </div>
      <div class="product-body">
        <h3 class="product-name">${escapeHtml(product.name || "Unnamed product")}</h3>
        <p class="muted provider-line">${escapeHtml(providerSummary(product))}</p>
        <p class="product-desc">${escapeHtml(product.description || "No description available")}</p>

        <div class="product-meta">
          <span class="rating-stars" title="Rating">${renderStars(rating)}</span>
          <span class="muted">${ratingLabel(product)}</span>
        </div>

        <div class="product-row">
          <p class="product-price">${formatMoney(product.price)}</p>
          <p class="stock ${outOfStock ? "out" : "in"}">${stockLabel(stock)}</p>
        </div>

        <div class="product-actions" onclick="event.stopPropagation()">
          <button class="btn btn-secondary" onclick="viewProduct(${product.id})">Quick View</button>
          ${canManage() ? `<button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>` : ""}
          ${canOrder() ? `<button class="btn btn-primary" ${outOfStock ? "disabled" : ""} onclick="addToCart(${product.id})">Add to Cart</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function populateCategoryFilter(products) {
  if (!categorySelect) return;
  const current = categorySelect.value || "all";
  const categories = Array.from(new Set(products.map((p) => String(p.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const options = [
    '<option value="all">Category: All</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ];
  categorySelect.innerHTML = options.join("");
  categorySelect.value = categories.includes(current) ? current : "all";
}

function populateProviderFilter(list) {
  if (!providerFilter) return;
  const current = providerFilter.value || "all";
  const options = [
    '<option value="all">Provider: All</option>',
    ...list.map((provider) => `<option value="${provider.id}">${escapeHtml(provider.name)}</option>`),
  ];
  providerFilter.innerHTML = options.join("");
  const exists = list.some((provider) => String(provider.id) === String(current));
  providerFilter.value = exists ? current : "all";
}

async function loadProviders() {
  if (!providerSelect) return;
  try {
    const data = await apiFetch("/providers/");
    providers = Array.isArray(data) ? data : [];
    const options = ['<option value=\"\">Select provider</option>'];
    providers.forEach((provider) => {
      const label = provider.verified ? `${provider.name} (Verified)` : provider.name;
      options.push(`<option value=\"${provider.id}\">${escapeHtml(label)}</option>`);
    });
    providerSelect.innerHTML = options.join(\"\");
    populateProviderFilter(providers);
  } catch (_err) {
    providerSelect.innerHTML = '<option value=\"\">Select provider</option>';
    populateProviderFilter([]);
  }
}

function applyFilters(products) {
  const text = (searchInput?.value || "").trim().toLowerCase();
  const sort = sortSelect?.value || "featured";
  const activeCategory = categorySelect?.value || "all";
  const activeProvider = providerFilter?.value || "all";

  let filtered = products.filter((p) => {
    const inCategory = activeCategory === "all" || String(p.category || "").trim() === activeCategory;
    if (!inCategory) return false;
    const inProvider = activeProvider === "all" || String(p.provider_id || "") === String(activeProvider);
    if (!inProvider) return false;
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
    filtered = filtered.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
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
  const imageUrl = resolveImageUrl(product.image_url);
  const provider = product.provider;

  productView.innerHTML = `
    <div class="product-view-panel">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Product")}" class="product-view-image" onerror="this.src='${FALLBACK_IMAGE}'">
      <div>
        <h3 class="product-view-name">${escapeHtml(product.name || "Unnamed product")}</h3>
        <p class="product-view-price">${formatMoney(product.price)}</p>
        <div class="product-meta">
          <span class="rating-stars">${renderStars(rating)}</span>
          <span class="muted">${ratingLabel(product)}</span>
        </div>
        <p class="product-view-line"><strong>Category:</strong> ${escapeHtml(product.category || "-")}</p>
        <p class="product-view-line"><strong>Provider:</strong> ${escapeHtml(providerSummary(product))}</p>
        ${provider?.location ? `<p class="product-view-line"><strong>Location:</strong> ${escapeHtml(provider.location)}</p>` : ""}
        ${provider?.email ? `<p class="product-view-line"><strong>Email:</strong> ${escapeHtml(provider.email)}</p>` : ""}
        ${provider?.phone ? `<p class="product-view-line"><strong>Phone:</strong> ${escapeHtml(provider.phone)}</p>` : ""}
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
    populateCategoryFilter(allProducts);
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
      provider_id: providerSelect?.value ? parseInt(providerSelect.value, 10) : null,
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
  renderCart();
  await loadProviders();
  fetchProducts();

  // Cart UI
  const cartTrigger = document.getElementById("cartTrigger");
  const cartPopout = document.getElementById("cartPopout");
  const closeCart = document.getElementById("closeCart");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (cartTrigger) {
    if (currentUser?.role !== "user") {
      cartTrigger.style.display = "none";
    }
    cartTrigger.addEventListener("click", () => cartPopout.classList.toggle("show"));
  }
  
  closeCart?.addEventListener("click", () => cartPopout.classList.remove("show"));
  checkoutBtn?.addEventListener("click", checkoutCart);

  const aiSuggestBtn = document.getElementById("aiSuggestBtn");
  aiSuggestBtn?.addEventListener("click", async () => {
    const name = document.getElementById("name").value.trim();
    const category = document.getElementById("category").value.trim();
    if (!name) {
      showFlash("error", "Enter a product name first.");
      return;
    }

    try {
      aiSuggestBtn.disabled = true;
      aiSuggestBtn.innerHTML = '<span class="material-symbols-outlined">sync</span> Thinking...';
      const data = await apiFetch("/products/ai-suggest", {
        method: "POST",
        body: JSON.stringify({ name, category }),
      });

      document.getElementById("description").value = data.description;
      document.getElementById("price").value = data.suggested_price;
      if (data.seo_keywords && data.seo_keywords.length > 0) {
        showFlash("success", "AI Suggested: " + data.seo_keywords.join(", "));
      }
    } catch (err) {
      showFlash("error", "AI Suggestion failed: " + err.message);
    } finally {
      aiSuggestBtn.disabled = false;
      aiSuggestBtn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> AI Suggest';
    }
  });

  searchInput?.addEventListener("input", renderProducts);
  sortSelect?.addEventListener("change", renderProducts);
  categorySelect?.addEventListener("change", renderProducts);
  providerFilter?.addEventListener("change", renderProducts);
  refreshBtn?.addEventListener("click", fetchProducts);
});

window.deleteProduct = deleteProduct;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkoutCart = checkoutCart;
