import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../assets/sokolink-logo.png";
import { useAuth } from "../features/auth/AuthContext";
import { useAIAssistant } from "../features/ai/AIAssistantContext";
import { useCart } from "../features/auth/CartContext";
import { env } from "../config/env";
import { getPostLoginPath } from "../features/auth/authStorage";
import { apiRequest } from "../lib/http";
import type { Product } from "../types/domain";

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

export function HomePage() {
  const { token, user, loading } = useAuth();
  const { openAssistant } = useAIAssistant();
  const { addToCart, setIsOpen } = useCart();
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
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
    if (newMode === "ai") {
      openAssistant();
    } else {
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function handleSearch() {
    if (!search.trim()) return;
    setError("");
    await fetchProducts(search, activeCategory);
    setHasSearched(true);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
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
    <div className="min-h-screen bg-surface-bg font-sans text-dark-bg selection:bg-brand/20">
      {/* Premium Navigation */}
      <header className="sticky top-0 z-50 w-full transition-all duration-300">
        <div className="bg-brand/90 backdrop-blur-md py-2 px-4 text-center">
          <p className="text-[11px] md:text-xs font-bold text-white uppercase tracking-[0.2em]">
            Systematic sourcing for modern trade • <button onClick={openAssistant} className="underline hover:text-accent transition-colors">Try AI Assistant</button>
          </p>
        </div>
        
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 shadow-sm py-4">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-8">
            <Link to="/" className="flex items-center gap-3 shrink-0 group">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center p-1.5 shadow-lg group-hover:scale-105 transition-transform duration-300">
                <img src={logoUrl} alt="SokoLink" className="w-full h-full object-contain" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-display font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">SokoLnk</span>
                <span className="text-[9px] uppercase font-bold text-brand tracking-widest leading-none">Smart Operations</span>
              </div>
            </Link>

            <div className="flex-1 max-w-2xl hidden md:flex relative group">
              <input
                type="text"
                className="w-full pl-5 pr-12 py-3 bg-slate-100/50 dark:bg-slate-700/50 border-2 border-transparent focus:border-brand/30 focus:bg-white dark:focus:bg-slate-700 rounded-2xl transition-all duration-300 outline-none text-sm font-medium text-slate-900 dark:text-white"
                placeholder="Search products, categories, or verified suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button 
                onClick={handleSearch}
                className="absolute right-2 top-1.5 p-1.5 bg-brand text-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-brand transition-colors">Sign In</Link>
              <Link to="/register/customer" className="btn-primary !text-sm !px-6 shadow-brand/20">Join Free</Link>
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-8 whitespace-nowrap py-3">
            {categoryValues.map((cat) => (
              <button
                key={cat}
                onClick={async (e) => {
                  e.preventDefault();
                  setActiveCategory(cat);
                  await fetchProducts(search, cat);
                  setHasSearched(true);
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`text-[13px] font-bold tracking-tight transition-all relative py-1
                  ${activeCategory === cat ? 'text-brand' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}
                `}
              >
                {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                {activeCategory === cat && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-24">
        {/* Immersive Hero Section */}
        <section className="relative h-[480px] md:h-[560px] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl animate-soft-enter">
          {SLIDES.map((slide, idx) => (
            <div 
              key={idx} 
              className={`absolute inset-0 transition-all duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
            >
              <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-16 space-y-4 md:space-y-6">
                <div className="max-w-3xl space-y-2 md:space-y-4">
                  <h1 className="text-3xl md:text-6xl font-display font-extrabold text-white leading-[1.1] tracking-tight">
                    {slide.title}
                  </h1>
                  <p className="text-base md:text-xl text-white/80 font-medium leading-relaxed max-w-2xl line-clamp-2 md:line-clamp-none">
                    {slide.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 md:gap-4">
                  <button onClick={() => activateMode("marketplace")} className="btn-primary !px-6 md:!px-8 !py-3 md:!py-4 text-base md:text-lg bg-white !text-slate-900 hover:!bg-slate-50">
                    Explore
                  </button>
                  <button onClick={() => activateMode("ai")} className="px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-bold text-white bg-white/10 backdrop-blur-md border border-white/20 rounded-xl hover:bg-white/20 transition-all">
                    Guided by AI
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          <div className="absolute bottom-8 right-8 flex gap-2">
            {SLIDES.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'}`}
              />
            ))}
          </div>
        </section>

        {/* Campaign Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CAMPAIGNS.map((campaign) => (
            <div
              key={campaign.title}
              onClick={() => {
                const target = campaign.title.includes("Bulk Buy") ? "request" : "products";
                document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="glass-card p-8 group cursor-pointer hover:border-brand/30 transition-all duration-300 hover:shadow-premium-hover hover:-translate-y-1 dark:bg-slate-800/50"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest mb-4">
                {campaign.accent}
              </span>
              <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand transition-colors">
                {campaign.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {campaign.copy}
              </p>
            </div>
          ))}
        </section>

        {/* Products Section */}
        <section id="products" className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">Recommended for you</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Trending products, verified seller badges, and smart pricing.</p>
            </div>
            <div className="flex items-center gap-2 text-brand font-bold">
              <span>Verified fulfillment only</span>
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {isLoadingProducts ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
              <p className="font-bold text-slate-400 dark:text-slate-500">Discovering best deals...</p>
            </div>
          ) : featuredItems.length === 0 ? (
            <div className="h-96 glass-card dark:bg-slate-800/50 flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No products match your search</h3>
                <p className="text-slate-500 dark:text-slate-400">Try a different keyword or category, or submit an RFQ and let sellers come to you.</p>
              </div>
              <button onClick={() => {setSearch(""); fetchProducts("", "all");}} className="btn-secondary">Clear All Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredItems.map((product) => (
                <article 
                  key={product.id} 
                  className="group bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[24px] overflow-hidden hover:shadow-premium-hover transition-all duration-500 hover:-translate-y-2 flex flex-col h-full cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <img 
                      src={resolveImageUrl(product.image_url)} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      loading="lazy" 
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-brand border border-white/50 dark:border-slate-600 shadow-sm">
                        {product.category || "General"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1 space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-slate-900 dark:text-white leading-snug group-hover:text-brand transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {(product.seller_name || "S")[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{product.seller_name || "Independent Seller"}</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mb-1">Price</span>
                        <span className="text-lg font-display font-extrabold text-slate-900 dark:text-white tracking-tight">{formatMoney(product.price)}</span>
                      </div>
                      <button
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
                        className="w-10 h-10 bg-slate-900 dark:bg-brand text-white rounded-xl flex items-center justify-center hover:bg-brand transition-all duration-300 shadow-lg active:scale-90"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* RFQ Section */}
        <section id="request" className="relative p-1 overflow-hidden rounded-[40px]">
          <div className="absolute inset-0 bg-brand-strong" />
          <div className="relative bg-white/5 backdrop-blur-3xl p-8 md:p-16 rounded-[39px] border border-white/10 flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/3 space-y-8">
              <div className="space-y-4">
                <span className="inline-block px-4 py-1.5 rounded-full bg-accent/20 text-accent text-xs font-black uppercase tracking-widest border border-accent/20">
                  Sourcing Hub
                </span>
                <h2 className="text-4xl md:text-5xl font-display font-extrabold text-white leading-tight tracking-tight">
                  Can&apos;t find what you need?
                </h2>
                <p className="text-white/70 text-lg font-medium leading-relaxed">
                  Send a detailed request to our verified network and let sellers recommend or source exactly what you need.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  "Systematic quote comparison",
                  "Verified seller sourcing",
                  "Consolidated fulfillment options"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-white/90 font-bold">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full bg-white dark:bg-slate-800 rounded-[32px] p-8 md:p-10 shadow-2xl">
              {error ? <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-bold flex items-center gap-3 border border-red-100 dark:border-red-800 animate-in fade-in duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div> : null}
              {flash ? <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-3 border border-emerald-100 dark:border-emerald-800 animate-in fade-in duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {flash}
              </div> : null}

              <form onSubmit={submitRfq} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Company Name</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.company_name} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, company_name: e.target.value }))} 
                    placeholder="E.g. Smart Retailers Ltd"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Contact Name</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.contact_name} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, contact_name: e.target.value }))} 
                    placeholder="Your Full Name"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Work Email</label>
                  <input 
                    type="email"
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.email} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, email: e.target.value }))} 
                    placeholder="name@company.com"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Phone Number</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.phone} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, phone: e.target.value }))} 
                    placeholder="+255..."
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Product Description</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.product_interest} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, product_interest: e.target.value }))} 
                    placeholder="What specific product are you looking for?"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Estimated Quantity</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.quantity} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, quantity: e.target.value }))} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Target Budget (TZS)</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                    value={rfqDraft.target_budget} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, target_budget: e.target.value }))} 
                    placeholder="Optional"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Additional Notes</label>
                  <textarea 
                    rows={4}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold resize-none text-slate-900 dark:text-white"
                    value={rfqDraft.notes} 
                    onChange={(e) => setRfqDraft((prev) => ({ ...prev, notes: e.target.value }))} 
                    placeholder="Describe specific specs, quality requirements, or delivery preferences..."
                  />
                </div>
                <div className="md:col-span-2 pt-4">
                  <button type="submit" className="w-full btn-primary !py-5 !text-lg !rounded-2xl shadow-brand/40">
                    Send Sourcing Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Premium Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 pt-24 pb-12 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col gap-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center p-1.5 shadow-lg">
                  <img src={logoUrl} alt="SokoLink" className="w-full h-full object-contain" />
                </div>
                <span className="font-display font-extrabold text-2xl tracking-tight">SokoLnk</span>
              </div>
              <p className="text-white/50 dark:text-white/40 leading-relaxed font-medium">
                The modern marketplace for reliable sourcing, seller trust, and visible fulfillment from order to delivery.
              </p>
            </div>
            
            <div className="space-y-6">
              <h4 className="font-display font-bold text-lg">Services</h4>
              <ul className="space-y-4">
                <li><a href="#request" className="text-white/60 hover:text-brand transition-colors font-medium">Product Requests</a></li>
                <li><button onClick={openAssistant} className="text-white/60 hover:text-brand transition-colors font-medium text-left">AI Shopping Assistant</button></li>
                <li><a href="#products" className="text-white/60 hover:text-brand transition-colors font-medium">Marketplace Catalog</a></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="font-display font-bold text-lg">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-white/60 hover:text-brand transition-colors font-medium">About Operations</a></li>
                <li><a href="#" className="text-white/60 hover:text-brand transition-colors font-medium">Verified Sourcing</a></li>
                <li><a href="#" className="text-white/60 hover:text-brand transition-colors font-medium">Trust & Safety</a></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="font-display font-bold text-lg">Partnerships</h4>
              <ul className="space-y-4">
                <li><Link to="/register/business" className="text-white/60 hover:text-brand transition-colors font-medium">Create Seller Store</Link></li>
                <li><Link to="/register/logistics" className="text-white/60 hover:text-brand transition-colors font-medium">Join Logistics Network</Link></li>
                <li><Link to="/login" className="text-white/60 hover:text-brand transition-colors font-medium">Partner Dashboard</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-bold text-white/30 uppercase tracking-[0.15em]">
            <p>© 2026 SokoLnk Smart Marketplace. Sourcing with Confidence.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
