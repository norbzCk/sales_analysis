import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../assets/salesLOGO.png";
import { useAuth } from "../features/auth/AuthContext";
import { getPostLoginPath } from "../features/auth/authStorage";
import { apiRequest } from "../lib/http";
import type { Product, Provider } from "../types/domain";
import "../../../frontend/css/style.css";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `http://127.0.0.1:8000${raw}`;
  return `http://127.0.0.1:8000/${raw.replace(/^\/+/, "")}`;
}

function productRating(product: Product) {
  return Number(product.rating_avg || 0);
}

function ratingCount(product: Product) {
  return Number(product.rating_count || 0);
}

function renderStars(ratingValue?: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(ratingValue || 0))));
  return `${"★".repeat(rounded)}${"✩".repeat(5 - rounded)}`;
}

export function HomePage() {
  const { token, user, loading } = useAuth();
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [rfqStatus, setRfqStatus] = useState("");

  useEffect(() => {
    if (!loading && token && user) {
      navigate(getPostLoginPath(user), { replace: true });
    }
  }, [loading, navigate, token, user]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [items, publicProviders] = await Promise.all([
        apiRequest<Product[]>("/products/public", { auth: false }),
        apiRequest<Provider[]>("/providers/public", { auth: false }),
      ]);
      setAllItems(Array.isArray(items) ? items : []);
      setProviders(Array.isArray(publicProviders) ? publicProviders : []);
    } catch {
      setAllItems([]);
      setProviders([]);
    }
  }

  const categoryValues = useMemo(() => {
    const categories = Array.from(new Set(allItems.map((item) => (item.category || "General").trim()).filter(Boolean)));
    return ["all", ...categories];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    let data = allItems.filter((item) => {
      const inCategory = activeCategory === "all" || (item.category || "").trim() === activeCategory;
      if (!inCategory) return false;
      if (!search.trim()) return true;
      return `${item.name || ""} ${item.category || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    });

    if (sort === "price_low") {
      data = data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === "price_high") {
      data = data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sort === "in_stock") {
      data = data.sort((a, b) => Number(Boolean(b.in_stock)) - Number(Boolean(a.in_stock)));
    }

    return data;
  }, [activeCategory, allItems, search, sort]);

  const frequentItems = useMemo(() => allItems.slice(0, 3), [allItems]);
  const hotPicks = useMemo(
    () =>
      [...allItems]
        .sort((a, b) => ratingCount(b) - ratingCount(a) || productRating(b) - productRating(a))
        .slice(0, 4),
    [allItems],
  );

  const supplierItems = useMemo(() => {
    if (providers.length) return providers;
    const categories = categoryValues.filter((item) => item !== "all");
    const locations = ["Dar es Salaam", "Nairobi", "Mumbai", "Shenzhen", "Dubai", "Ho Chi Minh City"];
    return categories.slice(0, 6).map((category, index) => ({
      id: index + 1,
      name: `${category} Co.`,
      location: locations[index % locations.length],
      email: `${category.toLowerCase().replace(/\s+/g, "-")}@kariakoo.local`,
      verified: index % 2 === 0,
      response_time: index % 2 === 0 ? "< 6 hrs" : "< 12 hrs",
      min_order_qty: index % 2 === 0 ? "200 pcs" : "100 pcs",
    }));
  }, [categoryValues, providers]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setImagePreviewUrl("");
      return;
    }
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleRfqSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRfqStatus("Submitting your RFQ...");
    const form = new FormData(event.currentTarget);
    const payload = {
      company_name: String(form.get("company_name") || "").trim(),
      contact_name: String(form.get("contact_name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      phone: String(form.get("phone") || "").trim() || null,
      product_interest: String(form.get("product_interest") || "").trim(),
      quantity: Number(form.get("quantity") || 0),
      target_budget: String(form.get("target_budget") || "").trim() || null,
      notes: String(form.get("notes") || "").trim() || null,
    };

    try {
      await apiRequest("/rfq", { method: "POST", auth: false, body: payload });
      event.currentTarget.reset();
      setRfqStatus("RFQ submitted. Suppliers will reach out soon.");
    } catch (err) {
      setRfqStatus(err instanceof Error ? err.message : "RFQ submission failed");
    }
  }

  function scrollToSection(selector: string) {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="public-page">
      <nav className="alibaba-nav">
        <div className="alibaba-topbar">
          <a href="#marketplace">Home</a>
          <a href="#support">Help Center</a>
          <a href="#rfq">Sell on Kariakoo</a>
          <a href="#suppliers">Deliver to Dar es Salaam</a>
        </div>
        <div className="alibaba-mainbar">
          <a href="#marketplace" className="alibaba-logo">
            <div className="alibaba-logo-icon">
              <img src={logoUrl} alt="Kariakoo Sales" />
            </div>
            <div className="alibaba-logo-text"><span>Kariakoo</span></div>
          </a>
          <div className="alibaba-search-bar">
            <input
              type="text"
              placeholder="Search products, manufacturers, or categories"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Search</button>
          </div>
          <div className="alibaba-actions">
            <Link to="/login" className="nav-signin">Sign In</Link>
            <Link to="/register/customer" className="btn btn-primary btn-join-free">Join Free</Link>
          </div>
        </div>
        <div className="alibaba-nav-links">
          <a href="#categories">Categories</a>
          <a href="#products">Products</a>
          <a href="#suppliers">Manufacturers</a>
          <a href="#rfq">Request for Quotation</a>
          <a href="#products">Sell Products</a>
          <a href="#suppliers">Become a Supplier</a>
          <a href="#support">Delivery Services</a>
        </div>
      </nav>

      <main className="public-wrap">
        <section className="market-hero" id="marketplace">
          <div className="hero-main">
            <div className="hero-tabs" role="tablist" aria-label="Marketplace filters">
              <button className="hero-tab active" type="button">AI Mode</button>
              <button className="hero-tab" type="button">Products</button>
              <button className="hero-tab" type="button">Manufacturers</button>
              <button className="hero-tab" type="button">Worldwide</button>
            </div>

            <h1 className="market-title">A unified digital marketplace for Kariakoo traders, customers, and delivery partners.</h1>
            <p className="market-subtitle">Sellers list live products with stock, prices, and store locations. Buyers compare vendors, place orders online, and receive goods safely through coordinated delivery and order tracking.</p>

            <div className="hero-search">
              <input
                id="publicSearch"
                placeholder="Search products, categories, or manufacturers"
                aria-label="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select id="publicSort" title="Sort results" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Sort: Featured</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="in_stock">In stock first</option>
              </select>
              <button className="btn btn-primary" id="publicSearchBtn" type="button">Search</button>
            </div>

            <div className="hero-search-meta">
              <label className="image-search" htmlFor="imageSearchInput">
                <input id="imageSearchInput" type="file" accept="image/*" onChange={handleImageChange} />
                <span>Image Search</span>
              </label>
              <div id="imageSearchPreview" className="image-preview">
                {imagePreviewUrl ? (
                  <div className="preview-card">
                    <img src={imagePreviewUrl} alt="Selected search" />
                    <span className="muted">Image ready</span>
                  </div>
                ) : null}
              </div>
              <span className="hero-tip">Try: smart watches, custom packaging, mobile phones</span>
            </div>

            <div id="publicSuggestions" className="hero-suggestions">
              {categoryValues.slice(1, 5).map((category) => (
                <button key={category} className="suggestion-chip" type="button" onClick={() => { setActiveCategory(category); setSearch(category); }}>
                  {category}
                </button>
              ))}
            </div>

            <div className="hero-metrics">
              <article className="metric-card">
                <p className="metric-label">Products</p>
                <p className="metric-value" id="statProducts">{allItems.length}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Active suppliers</p>
                <p className="metric-value" id="statSuppliers">{providers.length || Math.max((categoryValues.length - 1) * 12, 24)}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">In stock today</p>
                <p className="metric-value" id="statInStock">{allItems.filter((item) => item.in_stock).length}</p>
              </article>
            </div>
          </div>

          <aside className="hero-aside">
            <article className="hero-card">
              <p className="badge">Trade Assurance</p>
              <h3>Protect every payment.</h3>
              <p className="muted">Verified suppliers, transparent pricing, and delivery protection built in.</p>
              <button className="btn btn-secondary" type="button" onClick={() => scrollToSection("#rfq")}>Get protected</button>
            </article>
            <article className="hero-card highlight">
              <p className="badge">Request for Quotation</p>
              <h3>Send one RFQ, get multiple offers.</h3>
              <p className="muted">Describe your sourcing needs and receive curated supplier responses.</p>
              <button className="btn btn-primary" type="button" onClick={() => scrollToSection("#rfq")}>Start RFQ</button>
            </article>
            <article className="hero-card glass">
              <p className="badge">Top ranking</p>
              <h3>Trusted manufacturers.</h3>
              <p className="muted">Compare ratings, response times, and fulfillment history.</p>
            </article>
          </aside>
        </section>

        <section className="market-highlights">
          <article className="highlight-tile">
            <h3>Multi-vendor ordering</h3>
            <p className="muted">Buyers can compare sellers across the market and order from the best fit.</p>
          </article>
          <article className="highlight-tile">
            <h3>Reliable delivery coordination</h3>
            <p className="muted">Orders move from seller pickup to customer address with clearer coordination.</p>
          </article>
          <article className="highlight-tile">
            <h3>Safer, less crowded trade</h3>
            <p className="muted">The platform reduces unnecessary market visits while keeping goods moving on time.</p>
          </article>
        </section>

        <section className="market-discovery" id="categories">
          <aside className="market-categories">
            <h2 className="section-title">Categories for you</h2>
            <div id="publicCategoryList" className="category-list">
              {categoryValues.map((category) => (
                <button
                  key={category}
                  className={`category-chip${activeCategory === category ? " active" : ""}`}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                >
                  {category === "all" ? "All" : category}
                </button>
              ))}
            </div>
          </aside>

          <div className="market-featured">
            <div className="featured-card">
              <div className="featured-head">
                <h3>Frequently searched</h3>
                <span className="badge">Updated hourly</span>
              </div>
              <div id="publicFrequent" className="frequent-grid">
                {frequentItems.length ? frequentItems.map((item) => (
                  <article key={item.id} className="frequent-card" data-product-id={item.id} tabIndex={0} onClick={() => setSelectedProduct(item)}>
                    <h4>{item.category || "General"}</h4>
                    <p className="muted">{item.name || "Top pick"}</p>
                  </article>
                )) : <p className="muted">No trends yet.</p>}
              </div>
            </div>
            <div className="featured-card hot-picks">
              <div className="featured-head">
                <h3>Hot picks</h3>
                <span className="badge">Trending now</span>
              </div>
              <div id="publicHotPicks" className="hot-grid">
                {hotPicks.length ? hotPicks.map((item) => (
                  <article key={item.id} className="hot-card" data-product-id={item.id} tabIndex={0} onClick={() => setSelectedProduct(item)}>
                    <img src={resolveImageUrl(item.image_url)} alt={item.name || "Product"} loading="lazy" />
                    <div>
                      <h4>{item.name || "Product"}</h4>
                      <p className="muted">{item.category || "General"}</p>
                      <p className="hot-price">{formatMoney(item.price)}</p>
                    </div>
                  </article>
                )) : <p className="muted">No hot picks yet.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="card market-products" id="products">
          <div className="market-products-head">
            <div>
              <h2 className="section-title">Recommended for your business</h2>
              <p className="muted">Verified suppliers and trade-ready products.</p>
            </div>
            <span className="badge" id="publicShownBadge">Showing: {filteredItems.length}</span>
          </div>
          <div id="publicCategories" className="public-categories">
            {categoryValues.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-pill${activeCategory === category ? " active" : ""}`}
                onClick={() => setActiveCategory(category)}
              >
                {category === "all" ? "All products" : category}
              </button>
            ))}
          </div>
          <div id="publicProducts" className="public-product-grid">
            {filteredItems.length ? filteredItems.map((item) => {
              const rating = productRating(item);
              const count = ratingCount(item);
              return (
                <article
                  key={item.id}
                  className="public-product-card"
                  data-product-id={item.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${item.name || "product"}`}
                  onClick={() => setSelectedProduct(item)}
                >
                  <div className="product-card-media">
                    <img src={resolveImageUrl(item.image_url)} alt={item.name || "Product"} loading="lazy" />
                    <span className="pill">{item.in_stock ? "In stock" : "Out of stock"}</span>
                  </div>
                  <div>
                    <h3>{item.name || "Product"}</h3>
                    <p className="muted">{item.category || "General"}</p>
                    <div className="public-meta">
                      <span className="rating-stars">{renderStars(rating)}</span>
                      <span className="muted">{count ? `${rating.toFixed(1)} (${count})` : "No ratings yet"}</span>
                    </div>
                    <p className="public-price">{formatMoney(item.price)}</p>
                  </div>
                </article>
              );
            }) : <p className="muted">No products match this view.</p>}
          </div>
        </section>

        <section className="market-suppliers" id="suppliers">
          <div className="market-products-head">
            <div>
              <h2 className="section-title">Manufacturers you can trust</h2>
              <p className="muted">Compare suppliers by region, verification, and response time.</p>
            </div>
          </div>
          <div id="publicSuppliers" className="supplier-grid">
            {supplierItems.length ? supplierItems.map((provider) => (
              <article key={provider.id} className="supplier-card">
                <div className="supplier-head">
                  <div>
                    <h3>{provider.name || "Kariakoo Supplier"}</h3>
                    <p className="muted">{provider.location || "Kariakoo, TZ"}</p>
                  </div>
                  <span className={`pill ${provider.verified ? "verified" : ""}`}>{provider.verified ? "Verified" : "Factory"}</span>
                </div>
                <p className="muted">{provider.email || "Wholesale, sourcing, and fulfillment partner."}</p>
                <div className="supplier-meta">
                  <span>Response: {provider.response_time || "< 12 hrs"}</span>
                  <span>MOQ: {provider.min_order_qty || "100 pcs"}</span>
                </div>
              </article>
            )) : <p className="muted">Supplier data will appear after your first products are added.</p>}
          </div>
        </section>

        <section className="card market-rfq" id="rfq">
          <div className="rfq-copy">
            <h2 className="section-title">Request for quotation</h2>
            <p className="muted">Describe what you need and let suppliers compete for your order while the platform coordinates pricing, fulfillment, and delivery reliability.</p>
            <ul className="rfq-points">
              <li>Match with verified suppliers in minutes.</li>
              <li>Share specs, quantities, and target pricing once.</li>
              <li>Track responses, orders, and delivery progress inside your dashboard.</li>
            </ul>
          </div>
          <form id="rfqForm" className="rfq-form" onSubmit={handleRfqSubmit}>
            <input name="company_name" placeholder="Company name" required />
            <input name="contact_name" placeholder="Contact name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone (optional)" />
            <input name="product_interest" placeholder="Product or category" required />
            <input name="quantity" type="number" min="1" step="1" placeholder="Estimated quantity" required />
            <input name="target_budget" placeholder="Target budget (optional)" />
            <textarea name="notes" rows={3} placeholder="Specifications, customization, or delivery notes" />
            <button className="btn btn-primary" type="submit">Submit RFQ</button>
            <p id="rfqStatus" className="muted">{rfqStatus}</p>
          </form>
        </section>

        <section className="public-contact card" id="support">
          <h2 className="section-title">Contact</h2>
          <div className="public-contact-grid">
            <p><strong>Email:</strong> sales@yourcompany.com</p>
            <p><strong>Phone:</strong> +255 700 000 000</p>
            <p><strong>Address:</strong> Dar es Salaam, Tanzania</p>
            <p><strong>Working Hours:</strong> Mon - Sat, 08:00 - 18:00</p>
          </div>
          <p className="muted" style={{ marginTop: "16px" }}>
            Kariakoo Sales helps sellers publish inventory, lets customers order from different vendors, and supports delivery coordination so goods arrive safely and on time.
          </p>
        </section>
      </main>

      <div className={`public-modal${selectedProduct ? " show" : ""}`} id="publicModal" onClick={() => setSelectedProduct(null)}>
        <div className="public-modal-card" onClick={(event) => event.stopPropagation()}>
          <button className="public-modal-close" id="publicModalClose" type="button" onClick={() => setSelectedProduct(null)}>Close</button>
          <div id="publicModalBody">
            {selectedProduct ? (
              <div className="public-modal-layout">
                <img src={resolveImageUrl(selectedProduct.image_url)} alt={selectedProduct.name || "Product"} />
                <div>
                  <h3>{selectedProduct.name || "Product"}</h3>
                  <p className="muted">{selectedProduct.category || "General"}</p>
                  <p className="public-price">{formatMoney(selectedProduct.price)}</p>
                  <p className="muted">{selectedProduct.in_stock ? "Available now" : "Currently out of stock"}</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="public-modal-actions">
            <Link className="btn btn-secondary" to="/login">Login to Continue</Link>
            <Link className="btn btn-primary" to="/register/customer">Create Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
