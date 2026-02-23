const list = document.getElementById("publicProducts");
const searchInput = document.getElementById("publicSearch");
const sortSelect = document.getElementById("publicSort");
const categoriesWrap = document.getElementById("publicCategories");
const shownBadge = document.getElementById("publicShownBadge");
const modal = document.getElementById("publicModal");
const modalBody = document.getElementById("publicModalBody");
const modalClose = document.getElementById("publicModalClose");

let allItems = [];
let activeCategory = "all";

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
  const seed = Number(product.id || 1);
  return (4 + ((seed * 7) % 10) / 10).toFixed(1);
}

function card(item) {
  const rating = productRating(item);
  return `
    <article class="public-product-card" data-product-id="${item.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.name || "product")}">
      <img src="${escapeHtml(resolveImageUrl(item.image_url))}" alt="${escapeHtml(item.name || "Product")}" loading="lazy">
      <div>
        <h3>${escapeHtml(item.name || "Product")}</h3>
        <p class="muted">${escapeHtml(item.category || "General")}</p>
        <div class="public-meta">
          <span class="rating-stars">★★★★☆</span>
          <span class="muted">${rating}</span>
        </div>
        <p class="public-price">${formatMoney(item.price)}</p>
        <span class="badge">${item.in_stock ? "In stock" : "Out of stock"}</span>
      </div>
    </article>
  `;
}

function categoryList(items) {
  const categories = Array.from(new Set(items.map((i) => (i.category || "General").trim()).filter(Boolean)));
  return ["all", ...categories];
}

function renderCategories() {
  const cats = categoryList(allItems);
  categoriesWrap.innerHTML = cats
    .map((cat) => `<button class="chip ${activeCategory === cat ? "active" : ""}" data-category="${escapeHtml(cat)}" type="button">${cat === "all" ? "All" : escapeHtml(cat)}</button>`)
    .join("");

  categoriesWrap.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category || "all";
      renderProducts();
    });
  });
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
}

function renderProducts() {
  const items = filteredItems();
  shownBadge.textContent = `Showing: ${items.length}`;

  if (!items.length) {
    list.innerHTML = '<p class="muted">No products match this view.</p>';
    return;
  }

  list.innerHTML = items.map(card).join("");
  renderCategories();
  bindCardClicks();
}

async function loadPublicProducts() {
  try {
    const data = await fetch(`${window.API_BASE}/products/public`);
    if (!data.ok) throw new Error("Could not load products preview");
    const items = await data.json();
    allItems = Array.isArray(items) ? items : [];
    if (!allItems.length) {
      shownBadge.textContent = "Showing: 0";
      list.innerHTML = '<p class="muted">No products available yet.</p>';
      categoriesWrap.innerHTML = "";
      return;
    }
    renderProducts();
  } catch (err) {
    list.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (token) {
    try {
      const user = await apiFetch("/auth/me");
      redirectToPostLogin(user);
      return;
    } catch (_err) {
      clearSession();
    }
  }

  searchInput?.addEventListener("input", renderProducts);
  sortSelect?.addEventListener("change", renderProducts);
  modalClose?.addEventListener("click", () => modal.classList.remove("show"));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.remove("show");
  });

  loadPublicProducts();
});
