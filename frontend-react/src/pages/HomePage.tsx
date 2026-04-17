import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../assets/sokolink-logo.png";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { env } from "../config/env";
import { getPostLoginPath } from "../features/auth/authStorage";
import { apiRequest } from "../lib/http";
import type { Product } from "../types/domain";
import "./Home.css";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    title: "Systematic sourcing for modern trade",
    description: "Find reliable products, smarter pricing, and faster delivery coordination across the marketplace.",
  },
  {
    image: "https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?auto=format&fit=crop&w=1600&q=80",
    title: "AI-assisted discovery for buyers",
    description: "Switch to AI mode to describe what you want and get guided product suggestions instantly.",
  },
  {
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80",
    title: "Trusted sellers, visible fulfillment",
    description: "Browse top-rated sellers, compare routes, and track last-mile operations with confidence.",
  },
];

const CAMPAIGNS = [
  { title: "Fresh Delivery Week", copy: "Free routing optimization on grouped grocery orders.", accent: "Top campaign" },
  { title: "Verified Seller Spotlight", copy: "Featured badges help buyers trust high-performing stores.", accent: "Trust builder" },
  { title: "Bulk Buy Advantage", copy: "Send an RFQ when your needed product is not yet listed.", accent: "Buyer tool" },
];

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type ProductSearchResponse = {
  items: Product[];
  total: number;
  categories?: string[];
};

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function buildAssistantReply(prompt: string, products: Product[]) {
  const query = prompt.trim().toLowerCase();
  if (!query) {
    return "Tell me the product, budget, or category you want and I’ll suggest a shopping direction.";
  }

  const matches = products.filter((item) =>
    `${item.name || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase().includes(query),
  );
  if (matches.length) {
    const top = matches.slice(0, 3).map((item) => `${item.name} (${formatMoney(item.price)})`).join(", ");
    return `I found matches you can open right away: ${top}. You can also compare sellers or add them to cart from the catalog below.`;
  }

  const categoryHint = products.find((item) => (item.category || "").toLowerCase().includes(query));
  if (categoryHint?.category) {
    return `I did not find an exact keyword match, but ${categoryHint.category} looks close. Try browsing that category or submit an RFQ so sellers can source it for you.`;
  }

  return "I could not find a direct match yet. Use the request form below to tell the marketplace what you need, and a seller can respond with a recommendation or quote.";
}

export function HomePage() {
  const { token, user, loading } = useAuth();
  const { addToCart, setIsOpen } = useCart();
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mode, setMode] = useState<"marketplace" | "ai">("marketplace");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "AI mode is ready. Describe the product you need, your budget, or the kind of seller you want.",
    },
  ]);
  const [rfqDraft, setRfqDraft] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    product_interest: "",
    quantity: "1",
    target_budget: "",
    notes: "",
  });
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!loading && token && user) {
      navigate(getPostLoginPath(user), { replace: true });
    }
  }, [loading, navigate, token, user]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  async function fetchProducts(query = "", category = "all") {
    try {
      setIsLoadingProducts(true);
      if (!query.trim() && category === "all") {
        const items = await apiRequest<Product[]>("/products/public", { auth: false });
        setAllItems(Array.isArray(items) ? items : []);
        return;
      }

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);
      const response = await apiRequest<ProductSearchResponse>(`/products/public/search?${params.toString()}`, {
        auth: false,
      });
      setAllItems(response.items || []);
      if (Array.isArray(response.categories) && response.categories.length) {
        setCategories(["all", ...response.categories]);
      }
    } catch (err) {
      setError("Unable to load product results. Please try again.");
      setAllItems([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function load() {
    try {
      const [items, categoryData] = await Promise.all([
        apiRequest<Product[]>("/products/public", { auth: false }),
        apiRequest<{ categories: string[] }>("/products/public/categories", { auth: false }),
      ]);
      setAllItems(Array.isArray(items) ? items : []);
      setCategories(["all", ...(categoryData?.categories || [])]);
    } catch {
      setAllItems([]);
      setCategories(["all"]);
    }
  }

  const categoryValues = useMemo(() => categories, [categories]);

  const filteredItems = useMemo(() => {
    if (!search.trim() && activeCategory === "all") {
      return allItems;
    }
    return allItems.filter((item) => {
      const inCategory = activeCategory === "all" || (item.category || "").trim() === activeCategory;
      if (!inCategory) return false;
      if (!search.trim()) return true;
      return `${item.name || ""} ${item.category || ""} ${item.description || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
  }, [activeCategory, allItems, search]);

  const featuredItems = filteredItems.slice(0, 8);

  function activateMode(newMode: "marketplace" | "ai") {
    setMode(newMode);
    document.getElementById(newMode === "ai" ? "ai-mode" : "products")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSearch() {
    if (mode === "ai") {
      if (!search.trim()) {
        setError("Type a question in the search bar to ask AI for product recommendations.");
        return;
      }
      const reply = buildAssistantReply(search, allItems);
      setAssistantMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text: search.trim() },
        { id: `assistant-${Date.now() + 1}`, role: "assistant", text: reply },
      ]);
      setSearch("");
      document.getElementById("ai-mode")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setError("");
    await fetchProducts(search, activeCategory);
    setHasSearched(true);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = assistantInput.trim();
    if (!next) return;
    const reply = buildAssistantReply(next, allItems);
    setAssistantMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: next },
      { id: `assistant-${Date.now() + 1}`, role: "assistant", text: reply },
    ]);
    setAssistantInput("");
  }

  async function submitRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    try {
      await apiRequest("/rfq/", {
        method: "POST",
        auth: false,
        body: {
          ...rfqDraft,
          quantity: Number(rfqDraft.quantity || 1),
        },
      });
      setFlash("Your request has been sent. Sellers can now recommend or source what you need.");
      setRfqDraft({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        product_interest: "",
        quantity: "1",
        target_budget: "",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send product request");
    }
  }

  return (
    <div className="public-page">
      <header className="home-header">
        <div className="header-top">
          <span>Welcome to SokoLink - Your B2B Marketplace</span>
          <div className="header-top-links">
            <a href="#request">Can&apos;t find a product?</a>
            <a href="#ai-mode">AI Mode</a>
          </div>
        </div>
        <div className="header-main">
          <Link to="/" className="logo-link">
            <img src={logoUrl} alt="SokoLink" className="logo-img" />
            <span className="logo-text">SokoLink</span>
            <span className="logo-description">We deliver to right where you are!</span>
          </Link>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder={mode === "ai" ? "Ask AI for the product or price range you need" : "Search products, categories, or suppliers"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="search-button" onClick={handleSearch}>{mode === "ai" ? "Ask AI" : "Search"}</button>
          </div>
          <div className="header-actions">
            <Link to="/login" className="btn-login">Sign In</Link>
            <Link to="/register/customer" className="btn-register">Join Free</Link>
          </div>
        </div>
        <nav className="header-nav">
          {categoryValues.map((cat) => (
            <a
              key={cat}
              href={`#${cat}`}
              onClick={async (e) => {
                e.preventDefault();
                setActiveCategory(cat);
                await fetchProducts(search, cat);
                setHasSearched(true);
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={activeCategory === cat ? { color: "var(--brand-blue)", fontWeight: 700, borderBottom: "2px solid var(--brand-blue)" } : {}}
            >
              {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </a>
          ))}
        </nav>
      </header>

      <main className="home-main">
        <section className="slider-section">
          <div className="slider-container">
            {SLIDES.map((slide, idx) => (
              <div key={idx} className={`slide ${idx === currentSlide ? "active" : ""}`}>
                <img src={slide.image} alt={slide.title} className="slide-img" />
                <div className="slide-content">
                  <h2>{slide.title}</h2>
                  <p>{slide.description}</p>
                  <div className="hero-mode-toggle">
                    <button className={mode === "marketplace" ? "btn-register" : "btn-login"} onClick={() => activateMode("marketplace")}>
                      Marketplace mode
                    </button>
                    <button className={mode === "ai" ? "btn-register" : "btn-login"} onClick={() => activateMode("ai")}>
                      AI mode
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="slider-dots">
              {SLIDES.map((_, idx) => (
                <div key={idx} className={`dot ${idx === currentSlide ? "active" : ""}`} onClick={() => setCurrentSlide(idx)} />
              ))}
            </div>
          </div>
        </section>

        <section className="promo-strip">
          {CAMPAIGNS.map((campaign) => (
            <article
              key={campaign.title}
              className="promo-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                const target = campaign.title.includes("Bulk Buy") ? "request" : "products";
                document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="promo-badge">{campaign.accent}</span>
              <h3>{campaign.title}</h3>
              <p>{campaign.copy}</p>
            </article>
          ))}
        </section>

        <section className="ai-mode-section" id="ai-mode">
          <div className="section-head">
            <div>
              <h2>AI shopping agent</h2>
              <p className="muted">Switch between marketplace browsing and conversational discovery.</p>
            </div>
          </div>
          <div className="ai-agent-grid">
            <article className="ai-agent-panel">
              <div className="buyer-pill-row">
                <span className="buyer-badge buyer-badge--good">{mode === "ai" ? "AI mode active" : "Marketplace mode active"}</span>
                <span className="buyer-pill">Ask for products</span>
                <span className="buyer-pill">Get guided suggestions</span>
              </div>
              <div className="ai-agent-chat">
                {assistantMessages.map((message) => (
                  <div key={message.id} className={`ai-agent-bubble ai-agent-bubble--${message.role}`}>
                    {message.text}
                  </div>
                ))}
              </div>
              <form className="ai-agent-form" onSubmit={handleAssistantSubmit}>
                <input
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  placeholder="Ask for a product, price range, or type of seller"
                />
                <button className="search-button" type="submit">Ask AI</button>
              </form>
            </article>

            <article className="ai-agent-panel">
              <h3>Featured ad placements</h3>
              <div className="ad-board">
                <div className="ad-tile">
                  <strong>Sponsored launch</strong>
                  <p>Put new verified sellers in front of ready-to-buy customers.</p>
                </div>
                <div className="ad-tile">
                  <strong>Route-aware bundles</strong>
                  <p>Promote grouped local offers to reduce customer delivery cost.</p>
                </div>
                <div className="ad-tile">
                  <strong>AI campaign targeting</strong>
                  <p>Surface category campaigns based on what buyers search for most.</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-head">
            <div>
              <h2>Recommended for you</h2>
              <p className="muted">Trending products, seller badges, and quick add-to-cart actions.</p>
            </div>
          </div>

          {isLoadingProducts ? (
            <div className="products-empty-message">Loading products...</div>
          ) : featuredItems.length === 0 ? (
            <div className="products-empty-message">
              {hasSearched
                ? "No matching products were found. Try a different keyword or category, or submit an RFQ."
                : "No products are available at this moment. Check back soon or refine your search."}
            </div>
          ) : null}

          <div className="products-grid">
            {featuredItems.map((product) => (
              <article key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
                <div className="product-img-wrapper">
                  <img src={resolveImageUrl(product.image_url)} alt={product.name} className="product-img" loading="lazy" />
                </div>
                <div className="product-info">
                  <div className="product-category">{product.category || "General"}</div>
                  <h3 className="product-name">{product.name}</h3>
                  <div className="product-price">{formatMoney(product.price)}</div>
                  <div className="product-seller">
                    <div className="seller-avatar">{(product.seller_name || "S")[0].toUpperCase()}</div>
                    <span>{product.seller_name || "Independent Seller"}</span>
                  </div>
                  {product.seller?.badges?.length ? (
                    <div className="buyer-pill-row home-badges">
                      {product.seller.badges.slice(0, 2).map((badge) => (
                        <span key={badge.id} className="buyer-badge buyer-badge--good">{badge.label}</span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    className="btn-add-cart"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart({
                        id: product.id,
                        name: product.name,
                        price: product.price ?? 0,
                        image_url: resolveImageUrl(product.image_url),
                        seller_id: product.seller_id,
                        seller_name: product.seller_name || product.seller?.business_name || null,
                        seller_area: product.seller?.area || null,
                        seller_region: product.seller?.region || null,
                      });
                      setIsOpen(true);
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="request-section" id="request">
          <div className="section-head">
            <div>
              <h2>Can&apos;t find what you need?</h2>
              <p className="muted">Send a request and let sellers recommend or source the right products for you.</p>
            </div>
          </div>
          {error ? <p className="alert error">{error}</p> : null}
          {flash ? <p className="alert success">{flash}</p> : null}
          <form className="request-grid" onSubmit={submitRfq}>
            <label>Company<input value={rfqDraft.company_name} onChange={(e) => setRfqDraft((prev) => ({ ...prev, company_name: e.target.value }))} required /></label>
            <label>Contact name<input value={rfqDraft.contact_name} onChange={(e) => setRfqDraft((prev) => ({ ...prev, contact_name: e.target.value }))} required /></label>
            <label>Email<input type="email" value={rfqDraft.email} onChange={(e) => setRfqDraft((prev) => ({ ...prev, email: e.target.value }))} required /></label>
            <label>Phone<input value={rfqDraft.phone} onChange={(e) => setRfqDraft((prev) => ({ ...prev, phone: e.target.value }))} /></label>
            <label className="full-span">Product needed<input value={rfqDraft.product_interest} onChange={(e) => setRfqDraft((prev) => ({ ...prev, product_interest: e.target.value }))} required /></label>
            <label>Quantity<input type="number" min="1" value={rfqDraft.quantity} onChange={(e) => setRfqDraft((prev) => ({ ...prev, quantity: e.target.value }))} required /></label>
            <label>Target budget<input value={rfqDraft.target_budget} onChange={(e) => setRfqDraft((prev) => ({ ...prev, target_budget: e.target.value }))} placeholder="Optional" /></label>
            <label className="full-span">Recommendation notes<textarea value={rfqDraft.notes} onChange={(e) => setRfqDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={4} placeholder="Describe the product specs, quality level, or seller recommendation you want." /></label>
            <button className="btn-register request-submit" type="submit">Send request</button>
          </form>
        </section>
      </main>

      <footer className="home-footer" id="footer">
        <div className="footer-main">
          <div className="footer-col">
            <h4 style={{ color: "var(--brand-orange)", fontWeight: 700 }}>SokoLink</h4>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              The marketplace for reliable sourcing, seller trust, and visible fulfillment from order to delivery.
            </p>
          </div>
          <div className="footer-col">
            <h4>Customer Service</h4>
            <ul>
              <li><a href="#request">Product Requests</a></li>
              <li><a href="#ai-mode">AI Discovery</a></li>
              <li><a href="#products">Catalog</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Marketplace</h4>
            <ul>
              <li><a href="#products">Trending products</a></li>
              <li><a href="#request">Buyer recommendations</a></li>
              <li><a href="#ai-mode">AI shopping agent</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Sell on SokoLink</h4>
            <ul>
              <li><a href="/register/business">Create a store</a></li>
              <li><a href="/register/logistics">Join logistics</a></li>
              <li><a href="/login">Sign in</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 SokoLink. All rights reserved. | Sourcing with Confidence.</p>
        </div>
      </footer>
    </div>
  );
}
