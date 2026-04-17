import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import type { InventoryStats, Product, Provider } from "../types/domain";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

interface ProductDraft {
  name: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  image_url: string;
  provider_id: string;
  seller_id: string;
}

interface BusinessmanOption {
  id: number;
  business_name: string;
}

interface ProductInsight {
  description: string;
  suggested_price: number;
  seo_keywords: string[];
  confidence: number;
  trend_summary?: string | null;
  demand_level?: string | null;
  price_range?: {
    low?: number;
    high?: number;
    benchmark_average?: number;
  } | null;
}

interface InventoryForecastItem {
  product_id: number;
  product_name: string;
  current_stock: number;
  daily_burn_rate: number;
  days_left: number | string;
  weekly_demand?: number;
  recommended_restock?: number;
  risk_level?: string;
}

interface ProductRequestDraft {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  product_interest: string;
  quantity: string;
  target_budget: string;
  notes: string;
}

const emptyDraft: ProductDraft = {
  name: "",
  category: "",
  price: "",
  stock: "",
  description: "",
  image_url: "",
  provider_id: "",
  seller_id: "",
};

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function canManage(role?: string) {
  return ["admin", "super_admin", "owner", "seller"].includes(String(role || ""));
}

export function ProductsPage() {
  const { user } = useAuth();
  const { addToCart, setIsOpen } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [businessmen, setBusinessmen] = useState<BusinessmanOption[]>([]);
  const [inventory, setInventory] = useState<InventoryStats | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [insight, setInsight] = useState<ProductInsight | null>(null);
  const [forecast, setForecast] = useState<InventoryForecastItem[]>([]);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [requestDraft, setRequestDraft] = useState<ProductRequestDraft>({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    product_interest: "",
    quantity: "1",
    target_budget: "",
    notes: "",
  });

  const sellerMode = String(user?.role || "") === "seller";
  const adminMode = ["admin", "super_admin", "owner"].includes(String(user?.role || ""));

  useEffect(() => {
    void load();
  }, [sellerMode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [productData, providerData, inventoryData, forecastData] = await Promise.all([
        apiRequest<Product[]>("/products/"),
        apiRequest<Provider[]>("/providers/"),
        !adminMode && !sellerMode ? Promise.resolve(null) : apiRequest<InventoryStats>("/products/inventory/stats"),
        sellerMode ? apiRequest<{ items: InventoryForecastItem[] }>("/business/inventory/forecast") : Promise.resolve(null),
      ]);
      setProducts(productData);
      setProviders(providerData);
      setInventory(inventoryData);
      setForecast(forecastData?.items || []);

      if (adminMode) {
        const sellers = await apiRequest<{ items: BusinessmanOption[] }>("/business/");
        setBusinessmen(sellers.items || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  function resolveImageUrl(url?: string | null) {
    const raw = String(url || "").trim();
    if (!raw) return FALLBACK_IMAGE;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
    return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
  }

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(products.map((item) => item.category).filter(Boolean) as string[])).sort()],
    [products],
  );

  const visibleProducts = useMemo(() => {
    let data = [...products];
    if (category !== "all") {
      data = data.filter((item) => item.category === category);
    }
    if (search.trim()) {
      data = data.filter((item) => item.name?.toLowerCase().includes(search.toLowerCase()));
    }
    if (sort === "price_low") data.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "price_high") data.sort((a, b) => (b.price || 0) - (a.price || 0));
    return data;
  }, [products, category, search, sort]);

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setDraft({
      name: String(product.name || ""),
      category: String(product.category || ""),
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      description: String(product.description || ""),
      image_url: String(product.image_url || ""),
      provider_id: product.provider_id ? String(product.provider_id) : "",
      seller_id: product.seller_id ? String(product.seller_id) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft);
    setInsight(null);
    setFlash("");
    setError("");
  }

  async function generateInsight() {
    if (!draft.name.trim() || !draft.category.trim()) {
      setError("Enter a product name and category before generating AI insights.");
      return;
    }
    setGeneratingInsight(true);
    setError("");
    try {
      const data = await apiRequest<ProductInsight>("/products/ai-suggest", {
        method: "POST",
        body: {
          name: draft.name,
          category: draft.category,
          current_price: draft.price ? Number(draft.price) : null,
          stock: draft.stock ? Number(draft.stock) : null,
          description: draft.description || null,
          seller_area: user && "area" in user ? (user as never as { area?: string | null }).area : null,
        },
      });
      setInsight(data);
      setDraft((prev) => ({
        ...prev,
        description: data.description || prev.description,
        price: data.suggested_price ? String(Math.round(data.suggested_price)) : prev.price,
      }));
      setFlash("AI listing insight generated. Review and adjust before saving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI product insight");
    } finally {
      setGeneratingInsight(false);
    }
  }

  async function handleCreateOrUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");

    const payload = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      price: Number(draft.price || 0),
      stock: Number(draft.stock || 0),
      description: draft.description.trim(),
      image_url: draft.image_url.trim() || null,
      provider_id: draft.provider_id ? Number(draft.provider_id) : null,
      seller_id: draft.seller_id ? Number(draft.seller_id) : null,
    };

    if (!payload.name || !payload.category || payload.price <= 0 || !payload.description) {
      setError("Please provide a valid product name, category, price, and description.");
      return;
    }

    try {
      if (editingId) {
        await apiRequest(`/products/${editingId}`, { method: "PUT", body: payload });
        setFlash("Product updated successfully.");
      } else {
        await apiRequest("/products/", { method: "POST", body: payload });
        setFlash("Product created successfully.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiRequest<{ image_url: string }>("/products/upload-image", {
        method: "POST",
        body: formData,
      });
      setDraft((prev) => ({ ...prev, image_url: data.image_url }));
      setFlash("Image uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await apiRequest(`/products/${id}`, { method: "DELETE" });
      await load();
      setFlash("Product deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  async function submitProductRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    try {
      await apiRequest("/rfq/", {
        method: "POST",
        auth: false,
        body: {
          ...requestDraft,
          quantity: Number(requestDraft.quantity || 1),
        },
      });
      setFlash("Product request submitted successfully.");
      setRequestDraft({
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
      setError(err instanceof Error ? err.message : "Failed to submit product request");
    }
  }

  return (
    <div className="panel-stack">
      {inventory ? (
        <div className="stat-grid">
          <article className="stat-card">
            <span className="stat-label">Total Inventory</span>
            <strong>{inventory.total_products}</strong>
            <p className="muted">Across all categories</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Low Stock</span>
            <strong style={{ color: 'var(--brand-orange-strong)' }}>{inventory.low_stock_count}</strong>
            <p className="muted">Needs attention</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Out of Stock</span>
            <strong style={{ color: 'var(--danger)' }}>{inventory.out_of_stock_count}</strong>
            <p className="muted">Currently unavailable</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Total Value</span>
            <strong>{formatMoney(inventory.total_value)}</strong>
            <p className="muted">Estimated worth</p>
          </article>
        </div>
      ) : null}

      {sellerMode && forecast.length ? (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Smart inventory forecasting</h2>
              <p className="muted">Projected stock-out risk based on the last 30 days of sales.</p>
            </div>
          </div>
          <div className="stack-list">
            {forecast.slice(0, 4).map((item) => (
              <div key={item.product_id} className="list-card inventory-forecast-card">
                <div>
                  <strong>{item.product_name}</strong>
                  <p className="muted">
                    {item.current_stock} in stock · {item.daily_burn_rate.toFixed(1)} / day · approx. {item.days_left} days left
                  </p>
                </div>
                <div className="stack-list">
                  <span className={`buyer-badge${item.risk_level === "critical" ? " buyer-badge--danger" : item.risk_level === "watch" ? " buyer-badge--warn" : " buyer-badge--good"}`}>
                    {item.risk_level || "healthy"}
                  </span>
                  <span className="muted">Restock {item.recommended_restock || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      {canManage(user?.role) ? (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleCreateOrUpdate}>
          <div className="full-width">
            <h2>{editingId ? `Update Product #${editingId}` : "List New Product"}</h2>
            <p className="muted">Provide the details for your marketplace listing.</p>
          </div>

          <div className="full-width ai-insight-toolbar">
            <button className="secondary-button" type="button" onClick={() => void generateInsight()} disabled={generatingInsight}>
              {generatingInsight ? "Generating..." : "Generate AI listing insight"}
            </button>
            <span className="muted">Creates an SEO-friendly description and a price suggestion from marketplace activity.</span>
          </div>
          
          <label>Product Name<input value={draft.name} onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))} required /></label>
          <label>Category<input value={draft.category} onChange={(e) => setDraft(prev => ({ ...prev, category: e.target.value }))} required /></label>
          
          {adminMode ? (
            <label>
              Assign to Seller
              <select value={draft.seller_id} onChange={(e) => setDraft(prev => ({ ...prev, seller_id: e.target.value }))}>
                <option value="">Select Seller</option>
                {businessmen.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
              </select>
            </label>
          ) : null}
          
          <label>Price (TZS)<input type="number" value={draft.price} onChange={(e) => setDraft(prev => ({ ...prev, price: e.target.value }))} required /></label>
          <label>Initial Stock<input type="number" value={draft.stock} onChange={(e) => setDraft(prev => ({ ...prev, stock: e.target.value }))} required /></label>
          
          {!sellerMode ? (
            <label>
              Provider (Optional)
              <select value={draft.provider_id} onChange={(e) => setDraft(prev => ({ ...prev, provider_id: e.target.value }))}>
                <option value="">Select Provider</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : null}

          <label className="full-width">Detailed Description<textarea value={draft.description} onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))} required /></label>
          
          <label className="full-width">
            Product Image
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
              <input type="text" placeholder="Or enter Image URL" value={draft.image_url} onChange={(e) => setDraft(prev => ({ ...prev, image_url: e.target.value }))} />
            </div>
          </label>

          {draft.image_url && (
            <div className="full-width">
              <img src={resolveImageUrl(draft.image_url)} alt="Preview" style={{ width: '120px', height: '120px', borderRadius: '12px', objectFit: 'cover' }} />
            </div>
          )}

          {insight ? (
            <div className="full-width panel ai-insight-card">
              <div className="panel-header">
                <div>
                  <h3>AI-powered product insight</h3>
                  <p className="muted">{insight.trend_summary || "Marketplace-based pricing guidance"}</p>
                </div>
                <span className="buyer-badge buyer-badge--good">{Math.round((insight.confidence || 0) * 100)}% confidence</span>
              </div>
              <div className="two-column-grid">
                <div className="buyer-kpi">
                  <span className="muted">Suggested price</span>
                  <strong>{formatMoney(insight.suggested_price)}</strong>
                </div>
                <div className="buyer-kpi">
                  <span className="muted">Expected range</span>
                  <strong>{formatMoney(insight.price_range?.low)} - {formatMoney(insight.price_range?.high)}</strong>
                </div>
              </div>
              <p className="muted">{insight.description}</p>
              <div className="buyer-pill-row">
                <span className="buyer-badge">{insight.demand_level || "steady"} demand</span>
                {insight.seo_keywords?.map((keyword) => (
                  <span key={keyword} className="buyer-pill">{keyword}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="full-width" style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button className="primary-button" style={{ background: 'var(--brand-blue)', height: '48px', padding: '0 32px' }} type="submit">
              {editingId ? "Update Listing" : "Save Product"}
            </button>
            {editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      ) : null}

      <div className="panel filter-grid">
        <label>Search Catalog<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name..." /></label>
        <label>Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>
        <label>Sort By
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </label>
      </div>

      <div className="catalog-grid">
        {loading ? <div className="panel">Loading catalog...</div> : null}
        {visibleProducts.map((product) => (
          <article key={product.id} className="panel product-card-react" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <img 
              src={resolveImageUrl(product.image_url)} 
              alt={product.name} 
              className="product-card-image" 
              style={{ borderRadius: '0', cursor: 'pointer' }}
              onClick={() => navigate(`/app/product/${product.id}`)}
            />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/app/product/${product.id}`)}>
                  <h3 style={{ margin: '0' }}>{product.name}</h3>
                  <p className="muted" style={{ fontSize: '0.85rem' }}>{product.category}</p>
                </div>
                <strong style={{ color: 'var(--brand-blue)' }}>{formatMoney(product.price)}</strong>
              </div>
              <p className="muted" style={{ fontSize: '0.9rem', margin: '12px 0', height: '2.7rem', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/app/product/${product.id}`)}>{product.description}</p>
              {product.seller?.badges?.length ? (
                <div className="buyer-pill-row" style={{ marginBottom: '10px' }}>
                  {product.seller.badges.map((badge) => (
                    <span key={badge.id} className="buyer-badge buyer-badge--good">{badge.label}</span>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                <span className={`status-pill ${product.stock && product.stock > 0 ? "ok" : "danger"}`}>
                  {product.stock && product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {user?.role === "user" && (
                    <button 
                      className="primary-button" 
                      style={{ padding: '8px 16px', fontSize: '0.85rem', minWidth: '140px' }}
                      disabled={!(product.stock && product.stock > 0)}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        addToCart({
                          id: product.id,
                          name: product.name || "Product",
                          price: product.price || 0,
                          image_url: product.image_url,
                          seller_id: product.seller_id,
                          seller_name: product.seller_name || product.seller?.business_name || null,
                          seller_area: product.seller?.area || null,
                          seller_region: product.seller?.region || null,
                        });
                        setIsOpen(true);
                      }}
                    >
                      + Add to Cart
                    </button>
                  )}
                  {canManage(user?.role) && (
                    <>
                      <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); beginEdit(product); }}>Edit</button>
                      <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!canManage(user?.role) ? (
        <div className="panel ai-insight-card">
          <div className="panel-header">
            <div>
              <h2>Can&apos;t find what you need?</h2>
              <p className="muted">Send a product request and let the marketplace recommend sellers or source options for you.</p>
            </div>
          </div>
          <form className="form-grid auth-form-two-col" onSubmit={submitProductRequest}>
            <label>Company<input value={requestDraft.company_name} onChange={(e) => setRequestDraft((prev) => ({ ...prev, company_name: e.target.value }))} required /></label>
            <label>Contact name<input value={requestDraft.contact_name} onChange={(e) => setRequestDraft((prev) => ({ ...prev, contact_name: e.target.value }))} required /></label>
            <label>Email<input type="email" value={requestDraft.email} onChange={(e) => setRequestDraft((prev) => ({ ...prev, email: e.target.value }))} required /></label>
            <label>Phone<input value={requestDraft.phone} onChange={(e) => setRequestDraft((prev) => ({ ...prev, phone: e.target.value }))} /></label>
            <label className="full-width">Needed product<input value={requestDraft.product_interest} onChange={(e) => setRequestDraft((prev) => ({ ...prev, product_interest: e.target.value }))} required /></label>
            <label>Quantity<input type="number" min="1" value={requestDraft.quantity} onChange={(e) => setRequestDraft((prev) => ({ ...prev, quantity: e.target.value }))} required /></label>
            <label>Target budget<input value={requestDraft.target_budget} onChange={(e) => setRequestDraft((prev) => ({ ...prev, target_budget: e.target.value }))} /></label>
            <label className="full-width">Recommendation details<textarea rows={4} value={requestDraft.notes} onChange={(e) => setRequestDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Tell sellers the type, brand, quality, or substitute you want." /></label>
            <div className="full-width">
              <button className="primary-button" type="submit">Request recommendations</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
