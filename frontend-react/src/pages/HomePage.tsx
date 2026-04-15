import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../assets/sokolink-logo.png";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { getPostLoginPath } from "../features/auth/authStorage";
import { apiRequest } from "../lib/http";
import type { Product, Provider } from "../types/domain";
import "./Home.css";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    title: "Global Sourcing Made Simple",
    description: "Connect with verified manufacturers and suppliers worldwide."
  },
  {
    image: "https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?auto=format&fit=crop&w=1600&q=80",
    title: "Quality Products, Best Prices",
    description: "Discover millions of products ready for your business."
  },
  {
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80",
    title: "Secure Trade Assurance",
    description: "Protect your orders from payment to delivery."
  }
];

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

function renderStars(ratingValue?: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(ratingValue || 0))));
  return `${"★".repeat(rounded)}${"✩".repeat(5 - rounded)}`;
}

export function HomePage() {
  const { token, user, loading } = useAuth();
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  async function load() {
    try {
      const items = await apiRequest<Product[]>("/products/public", { auth: false });
      setAllItems(Array.isArray(items) ? items : []);
    } catch {
      setAllItems([]);
    }
  }

  const categoryValues = useMemo(() => {
    const categories = Array.from(new Set(allItems.map((item) => (item.category || "General").trim()).filter(Boolean)));
    return ["all", ...categories];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const inCategory = activeCategory === "all" || (item.category || "").trim() === activeCategory;
      if (!inCategory) return false;
      if (!search.trim()) return true;
      return `${item.name || ""} ${item.category || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [activeCategory, allItems, search]);

  function handleSearch() {
    if (search.trim()) {
      setActiveCategory("all");
    }
    const element = document.getElementById("products");
    element?.scrollIntoView({ behavior: "smooth" });
  }

  function handleTabClick(tab: string) {
    setCurrentSlide(0); // Optional: reset slider or use for state
    if (tab === "Products") {
      setActiveCategory("all");
      setSearch("");
    } else if (tab === "Manufacturers") {
      setSearch("manufacturer"); // Or handle specifically
    } else if (tab === "Worldwide") {
      setSearch("global");
    }
    const element = document.getElementById("products");
    element?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="public-page">
      <header className="home-header">
        <div className="header-top">
          <span>Welcome to SokoLink - Your B2B Marketplace</span>
          <div className="header-top-links">
            <a href="#rfq" onClick={(e) => { e.preventDefault(); document.getElementById('footer')?.scrollIntoView({behavior: 'smooth'}); }}>Sell on SokoLnk</a>
            <a href="#support" onClick={(e) => { e.preventDefault(); document.getElementById('footer')?.scrollIntoView({behavior: 'smooth'}); }}>Help Center</a>
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
              placeholder="What are you looking for today?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="search-button" onClick={handleSearch}>Search</button>
          </div>
          <div className="header-actions">
            <Link to="/login" className="btn-login">Sign In</Link>
            <Link to="/register/customer" className="btn-register">Join Free</Link>
          </div>
        </div>
        <nav className="header-nav">
          {['all', ...categoryValues.filter(c => c !== 'all')].map(cat => (
            <a 
              key={cat} 
              href={`#${cat}`} 
              onClick={(e) => { e.preventDefault(); setActiveCategory(cat); document.getElementById('products')?.scrollIntoView({behavior: 'smooth'}); }}
              style={activeCategory === cat ? { color: 'var(--brand-blue)', fontWeight: 700, borderBottom: '2px solid var(--brand-blue)' } : {}}
            >
              {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </a>
          ))}
        </nav>
      </header>

      <main className="home-main">
        <section className="slider-section">
          <div className="slider-container">
            {SLIDES.map((slide, idx) => (
              <div key={idx} className={`slide ${idx === currentSlide ? 'active' : ''}`}>
                <img src={slide.image} alt={slide.title} className="slide-img" />
                <div className="slide-content">
                  <h2>{slide.title}</h2>
                  <p>{slide.description}</p>
                  <Link to="/register/customer" className="btn-register" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>Get Started</Link>
                </div>
              </div>
            ))}
            <div className="slider-dots">
              {SLIDES.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`dot ${idx === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(idx)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-head">
            <div>
              <h2>Recommended for You</h2>
              <p className="muted">Based on latest trends and top-rated suppliers</p>
            </div>
          </div>

          <div className="products-grid">
            {filteredItems.map((product) => (
              <article 
                key={product.id} 
                className="product-card"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="product-img-wrapper">
                  <img 
                    src={resolveImageUrl(product.image_url)} 
                    alt={product.name} 
                    className="product-img"
                    loading="lazy" 
                  />
                </div>
                <div className="product-info">
                  <div className="product-category">{product.category || "General"}</div>
                  <h3 className="product-name">{product.name}</h3>
                  <div className="product-price">{formatMoney(product.price)}</div>
                  <div className="product-seller">
                    <div className="seller-avatar">
                      {(product.seller_name || "S")[0].toUpperCase()}
                    </div>
                    <span>{product.seller_name || "Independent Seller"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer" id="footer">
        <div className="footer-main">
          <div className="footer-col">
            <h4 style={{ color: 'var(--brand-orange)', fontWeight: 700 }}>SokoLink</h4>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              The leading B2B marketplace for global trade. Connecting millions of buyers and suppliers around the world.
            </p>
          </div>
          <div className="footer-col">
            <h4>Customer Service</h4>
            <ul>
              <li><a href="#help">Help Center</a></li>
              <li><a href="#report">Report Abuse</a></li>
              <li><a href="#dispute">Submit a Dispute</a></li>
              <li><a href="#policies">Policies & Rules</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>About Us</h4>
            <ul>
              <li><a href="#about">About SokoLnk</a></li>
              <li><a href="#sustainability">Sustainability</a></li>
              <li><a href="#careers">Careers</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Sell on SokoLink</h4>
            <ul>
              <li><a href="#supplier">Supplier Memberships</a></li>
              <li><a href="#learning">Learning Center</a></li>
              <li><a href="#partner">Partner Program</a></li>
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
