const list = document.getElementById("publicProducts");
const searchInput = document.getElementById("publicSearch");
const sortSelect = document.getElementById("publicSort");
const categoriesWrap = document.getElementById("publicCategories");
const shownBadge = document.getElementById("publicShownBadge");
const modal = document.getElementById("publicModal");
const modalBody = document.getElementById("publicModalBody");
const modalClose = document.getElementById("publicModalClose");
const categoryListWrap = document.getElementById("publicCategoryList");
const suggestionsWrap = document.getElementById("publicSuggestions");
const frequentWrap = document.getElementById("publicFrequent");
const hotPicksWrap = document.getElementById("publicHotPicks");
const suppliersWrap = document.getElementById("publicSuppliers");
const imageSearchInput = document.getElementById("imageSearchInput");
const imagePreview = document.getElementById("imageSearchPreview");
const searchBtn = document.getElementById("publicSearchBtn");
const rfqForm = document.getElementById("rfqForm");
const rfqStatus = document.getElementById("rfqStatus");

let allItems = [];
let activeCategory = "all";
let publicProviders = [];

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
  if (!raw) return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${window.API_BASE}${raw}`;
  return `${window.API_BASE}/${raw.replace(/^\/+/, "")}`;
}

function productRating(product) {
  return Number(product.rating_avg || 0);
}

function ratingCount(product) {
  return Number(product.rating_count || 0);
}

function renderStars(ratingValue) {
  const rating = Number(ratingValue || 0);
  if (rating <= 0) return "";
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(rounded)}${"✩".repeat(5 - rounded)}`;
}

function renderBadges(badges) {
  if (!badges || !badges.length) return "";
  return badges.map(b => `
    <span class="badge badge-verified" title="${b.label}">
      <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">${b.icon}</span> ${b.label}
    </span>
  `).join("");
}

function card(item) {
  const rating = productRating(item);
  const count = ratingCount(item);
  const badges = renderBadges(item.seller?.badges);
  return `
    <article class="public-product-card" data-product-id="${item.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.name || "product")}">
      <div class="product-card-media">
        <img src="${escapeHtml(resolveImageUrl(item.image_url))}" alt="${escapeHtml(item.name || "Product")}" loading="lazy">
        <div class="badge-group" style="position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 4px;">
          <span class="pill" style="background: rgba(0,0,0,0.6); color: white;">${item.in_stock ? "In stock" : "Out of stock"}</span>
          ${badges}
        </div>
      </div>
      <div>
        <h3>${escapeHtml(item.name || "Product")}</h3>
        <p class="muted">${escapeHtml(item.category || "General")}</p>
        <div class="public-meta">
          <span class="rating-stars">${renderStars(rating)}</span>
          <span class="muted">${count ? `${rating.toFixed(1)} (${count})` : "No ratings yet"}</span>
        </div>
        <p class="public-price">${formatMoney(item.price)}</p>
      </div>
    </article>
  `;
}

function hotPickCard(item) {
  return `
    <article class="hot-card" data-product-id="${item.id}" tabindex="0">
      <img src="${escapeHtml(resolveImageUrl(item.image_url))}" alt="${escapeHtml(item.name || "Product")}" loading="lazy">
      <div>
        <h4>${escapeHtml(item.name || "Product")}</h4>
        <p class="muted">${escapeHtml(item.category || "General")}</p>
        <p class="hot-price">${formatMoney(item.price)}</p>
      </div>
    </article>
  `;
}

function frequentCard(item) {
  return `
    <article class="frequent-card" data-product-id="${item.id}" tabindex="0">
      <h4>${escapeHtml(item.category || "General")}</h4>
      <p class="muted">${escapeHtml(item.name || "Top pick")}</p>
    </article>
  `;
}

function supplierCard(provider) {
  const name = provider.name || "Kariakoo Supplier";
  const location = provider.location || "Kariakoo, TZ";
  const response = provider.response_time || "< 12 hrs";
  const moq = provider.min_order_qty || "100 pcs";
  const verified = !!provider.verified;
  return `
    <article class="supplier-card">
      <div class="supplier-head">
        <div>
          <h3>${escapeHtml(name)}</h3>
          <p class="muted">${escapeHtml(location)}</p>
        </div>
        <span class="pill ${verified ? "verified" : ""}">${verified ? "Verified" : "Factory"}</span>
      </div>
      <p class="muted">${escapeHtml(provider.email || "Wholesale, sourcing, and fulfillment partner.")}</p>
      <div class="supplier-meta">
        <span>Response: ${escapeHtml(response)}</span>
        <span>MOQ: ${escapeHtml(moq)}</span>
      </div>
    </article>
  `;
}

function categoryList(items) {
  const categories = Array.from(new Set(items.map((i) => (i.category || "General").trim()).filter(Boolean)));
  return ["all", ...categories];
}

function setActiveCategory(category) {
  activeCategory = category || "all";
  renderProducts();
  renderCategoryMenus();
}

function renderCategoryMenus() {
  const cats = categoryList(allItems);
  const displayCats = cats.filter((cat) => cat !== "all");

  if (categoriesWrap) {
    categoriesWrap.innerHTML = cats
      .map((cat) => `<button class="chip ${activeCategory === cat ? "active" : ""}" data-category="${escapeHtml(cat)}" type="button">${cat === "all" ? "All" : escapeHtml(cat)}</button>`)
      .join("");

    categoriesWrap.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => setActiveCategory(btn.dataset.category || "all"));
    });
  }

  if (categoryListWrap) {
    categoryListWrap.innerHTML = displayCats
      .slice(0, 10)
      .map((cat) => `<button class="category-item ${activeCategory === cat ? "active" : ""}" data-category="${escapeHtml(cat)}" type="button">${escapeHtml(cat)}</button>`)
      .join("");
    categoryListWrap.querySelectorAll(".category-item").forEach((btn) => {
      btn.addEventListener("click", () => setActiveCategory(btn.dataset.category || "all"));
    });
  }

  if (suggestionsWrap) {
    suggestionsWrap.innerHTML = displayCats
      .slice(0, 6)
      .map((cat) => `<button class="suggestion" data-category="${escapeHtml(cat)}" type="button">${escapeHtml(cat)}</button>`)
      .join("");
    suggestionsWrap.querySelectorAll(".suggestion").forEach((btn) => {
      btn.addEventListener("click", () => setActiveCategory(btn.dataset.category || "all"));
    });
  }
}

function filteredItems() {
  const text = (searchInput?.value || "").trim().toLowerCase();
  const sort = sortSelect?.value || "featured";

  let data = allItems.filter((i) => {
    const inCat = activeCategory === "all" || (i.category || "").trim() === activeCategory;
    if (!inCat) return false;
    if (!text) return true;
    return `${i.name || ""} ${i.category || ""}`.toLowerCase().includes(text);
  });

  if (sort === "price_low") {
    data = data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === "price_high") {
    data = data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === "in_stock") {
    data = data.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
  }

  return data;
}

function openModal(item) {
  modalBody.innerHTML = `
    <div class="public-modal-layout">
      <img src="${escapeHtml(resolveImageUrl(item.image_url))}" alt="${escapeHtml(item.name || "Product")}">
      <div>
        <h3>${escapeHtml(item.name || "Product")}</h3>
        <p class="muted">${escapeHtml(item.category || "General")}</p>
        <p class="public-price">${formatMoney(item.price)}</p>
        <p class="muted">${item.in_stock ? "Available now" : "Currently out of stock"}</p>
      </div>
    </div>
  `;
  modal.classList.add("show");
}

function bindCardClicks() {
  const cards = Array.from(list.querySelectorAll(".public-product-card"));
  cards.forEach((cardEl) => {
    const id = Number(cardEl.dataset.productId);
    const item = allItems.find((p) => Number(p.id) === id);
    if (!item) return;

    cardEl.addEventListener("click", () => openModal(item));
    cardEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(item);
      }
    });
  });

  document.querySelectorAll(".hot-card, .frequent-card").forEach((cardEl) => {
    if (cardEl.dataset.bound) return;
    cardEl.dataset.bound = "true";
    const id = Number(cardEl.dataset.productId);
    const item = allItems.find((p) => Number(p.id) === id);
    if (!item) return;
    cardEl.addEventListener("click", () => openModal(item));
    cardEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(item);
      }
    });
  });
}

function renderMetrics() {
  const total = allItems.length;
  const categories = categoryList(allItems).length - 1;
  const inStock = allItems.filter((item) => item.in_stock).length;
  const statProducts = document.getElementById("statProducts");
  const statSuppliers = document.getElementById("statSuppliers");
  const statInStock = document.getElementById("statInStock");
  if (statProducts) statProducts.textContent = String(total);
  if (statSuppliers) {
    const supplierCount = publicProviders.length || Math.max(categories * 12, 24);
    statSuppliers.textContent = String(supplierCount);
  }
  if (statInStock) statInStock.textContent = String(inStock);
}

function renderFrequent(items) {
  if (!frequentWrap) return;
  const picks = items.slice(0, 3);
  frequentWrap.innerHTML = picks.length
    ? picks.map(frequentCard).join("")
    : '<p class="muted">No trends yet.</p>';
}

function renderHotPicks(items) {
  if (!hotPicksWrap) return;
  const picks = [...items]
    .sort((a, b) => ratingCount(b) - ratingCount(a) || productRating(b) - productRating(a))
    .slice(0, 4);
  hotPicksWrap.innerHTML = picks.length
    ? picks.map(hotPickCard).join("")
    : '<p class="muted">No hot picks yet.</p>';
}

function renderSuppliers(list = []) {
  if (!suppliersWrap) return;
  let providers = list.length ? list : [];
  if (!providers.length) {
    const categories = categoryList(allItems).filter((cat) => cat !== "all");
    const locations = ["Dar es Salaam", "Nairobi", "Mumbai", "Shenzhen", "Dubai", "Ho Chi Minh City"];
    providers = categories.slice(0, 6).map((cat, idx) => ({
      name: `${cat} Co.`,
      location: locations[idx % locations.length],
      email: `${cat.toLowerCase().replace(/\s+/g, "-")}@kariakoo.local`,
      verified: idx % 2 === 0,
      response_time: idx % 2 === 0 ? "< 6 hrs" : "< 12 hrs",
      min_order_qty: idx % 2 === 0 ? "200 pcs" : "100 pcs",
    }));
  }
  suppliersWrap.innerHTML = providers.length
    ? providers.map(supplierCard).join("")
    : '<p class="muted">Supplier data will appear after your first products are added.</p>';
}

function renderProducts() {
  const items = filteredItems();
  if (shownBadge) shownBadge.textContent = `Showing: ${items.length}`;

  if (!items.length) {
    list.innerHTML = '<p class="muted">No products match this view.</p>';
    return;
  }

  list.innerHTML = items.map(card).join("");
  bindCardClicks();
}

async function loadPublicProducts() {
  try {
    const data = await fetch(`${window.API_BASE}/products/public`);
    if (!data.ok) throw new Error("Could not load products preview");
    const items = await data.json();
    allItems = Array.isArray(items) ? items : [];
    if (!allItems.length) {
      if (shownBadge) shownBadge.textContent = "Showing: 0";
      list.innerHTML = '<p class="muted">No products available yet.</p>';
      if (categoriesWrap) categoriesWrap.innerHTML = "";
      if (categoryListWrap) categoryListWrap.innerHTML = "";
      return;
    }
    renderCategoryMenus();
    renderMetrics();
    renderProducts();
    renderFrequent(allItems);
    renderHotPicks(allItems);
    renderSuppliers(publicProviders);
  } catch (err) {
    list.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadPublicProviders() {
  if (!suppliersWrap) return;
  try {
    const response = await fetch(`${window.API_BASE}/providers/public`);
    if (!response.ok) throw new Error("Could not load suppliers");
    const data = await response.json();
    publicProviders = Array.isArray(data) ? data : [];
    if (publicProviders.length) {
      const statSuppliers = document.getElementById("statSuppliers");
      if (statSuppliers) statSuppliers.textContent = String(publicProviders.length);
      renderSuppliers(publicProviders);
    }
  } catch (_err) {
    publicProviders = [];
    renderSuppliers([]);
  }
}

function bindImageSearch() {
  if (!imageSearchInput || !imagePreview) return;
  imageSearchInput.addEventListener("change", () => {
    const file = imageSearchInput.files && imageSearchInput.files[0];
    if (!file) {
      imagePreview.innerHTML = "";
      return;
    }
    const url = URL.createObjectURL(file);
    imagePreview.innerHTML = `
      <div class="preview-card">
        <img src="${url}" alt="Selected search" />
        <span class="muted">Image ready</span>
      </div>
    `;
  });
}

function bindScrollButtons() {
  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.scroll);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function bindRFQ() {
  if (!rfqForm) return;
  rfqForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (rfqStatus) rfqStatus.textContent = "Submitting your RFQ...";

    const payload = {
      company_name: document.getElementById("rfqCompany").value.trim(),
      contact_name: document.getElementById("rfqContact").value.trim(),
      email: document.getElementById("rfqEmail").value.trim(),
      phone: document.getElementById("rfqPhone").value.trim() || null,
      product_interest: document.getElementById("rfqProduct").value.trim(),
      quantity: Number(document.getElementById("rfqQuantity").value || 0),
      target_budget: document.getElementById("rfqBudget").value.trim() || null,
      notes: document.getElementById("rfqNotes").value.trim() || null,
    };

    if (!payload.company_name || !payload.contact_name || !payload.email || !payload.product_interest || !payload.quantity) {
      if (rfqStatus) rfqStatus.textContent = "Please complete all required RFQ fields.";
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE}/rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "RFQ submission failed");
      }
      rfqForm.reset();
      if (rfqStatus) rfqStatus.textContent = "RFQ submitted. Suppliers will reach out soon.";
    } catch (err) {
      if (rfqStatus) rfqStatus.textContent = err.message;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (token) {
    try {
      const userType = (localStorage.getItem("user_type") || "").toLowerCase();
      let user = null;
      if (userType === "business") {
        user = await apiFetch("/business/me");
      } else if (userType === "logistics") {
        user = await apiFetch("/logistics/me");
      } else {
        user = await apiFetch("/auth/me");
      }
      const normalized = normalizeUser(user, userType || "user");
      setSession(token, normalized, userType || "user");
      redirectToPostLogin(normalized);
      return;
    } catch (_err) {
      clearSession();
    }
  }

  searchInput?.addEventListener("input", renderProducts);
  sortSelect?.addEventListener("change", renderProducts);
  searchBtn?.addEventListener("click", renderProducts);

  modalClose?.addEventListener("click", () => modal.classList.remove("show"));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.remove("show");
  });

  bindImageSearch();
  bindScrollButtons();
  bindRFQ();
  await loadPublicProviders();
  loadPublicProducts();
});
