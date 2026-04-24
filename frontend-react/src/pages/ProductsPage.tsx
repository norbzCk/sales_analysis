import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [businessmen, setBusinessmen] = useState<BusinessmanOption[]>([]);
  const [inventory, setInventory] = useState<InventoryStats | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
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

  useEffect(() => {
    setSearch(searchParams.get("q") || searchParams.get("seller") || "");
    setCategory(searchParams.get("category") || "all");
  }, [searchParams]);

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
      const keyword = search.toLowerCase();
      data = data.filter((item) =>
        `${item.name || ""} ${item.category || ""} ${item.seller_name || ""} ${item.seller?.business_name || ""}`
          .toLowerCase()
          .includes(keyword),
      );
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
    <div className="space-y-6">
      {inventory ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-white rounded-lg shadow p-6">
            <span className="text-sm text-gray-500">Total Inventory</span>
            <strong className="block text-2xl font-bold text-gray-900">{inventory.total_products}</strong>
            <p className="text-sm text-gray-500 mt-1">Across all categories</p>
          </article>
          <article className="bg-white rounded-lg shadow p-6">
            <span className="text-sm text-gray-500">Low Stock</span>
            <strong className="block text-2xl font-bold text-orange-600">{inventory.low_stock_count}</strong>
            <p className="text-sm text-gray-500 mt-1">Needs attention</p>
          </article>
          <article className="bg-white rounded-lg shadow p-6">
            <span className="text-sm text-gray-500">Out of Stock</span>
            <strong className="block text-2xl font-bold text-red-600">{inventory.out_of_stock_count}</strong>
            <p className="text-sm text-gray-500 mt-1">Currently unavailable</p>
          </article>
          <article className="bg-white rounded-lg shadow p-6">
            <span className="text-sm text-gray-500">Total Value</span>
            <strong className="block text-2xl font-bold text-gray-900">{formatMoney(inventory.total_value)}</strong>
            <p className="text-sm text-gray-500 mt-1">Estimated worth</p>
          </article>
        </div>
      ) : null}

      {sellerMode && forecast.length ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Smart inventory forecasting</h2>
              <p className="text-sm text-gray-500 mt-1">Projected stock-out risk based on the last 30 days of sales.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {forecast.slice(0, 4).map((item) => (
              <div key={item.product_id} className="p-6 flex items-center justify-between">
                <div>
                  <strong className="text-gray-900">{item.product_name}</strong>
                  <p className="text-sm text-gray-500 mt-1">
                    {item.current_stock} in stock · {item.daily_burn_rate.toFixed(1)} / day · approx. {item.days_left} days left
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.risk_level === "critical" ? "bg-red-100 text-red-800" :
                    item.risk_level === "watch" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {item.risk_level || "healthy"}
                  </span>
                  <span className="text-sm text-gray-500">Restock {item.recommended_restock || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</p> : null}
      {flash ? <p className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">{flash}</p> : null}

      {canManage(user?.role) ? (
        <form className="bg-white rounded-lg shadow p-6 space-y-4" onSubmit={handleCreateOrUpdate}>
          <div className="col-span-full">
            <h2 className="text-xl font-bold text-gray-900">{editingId ? `Update Product #${editingId}` : "List New Product"}</h2>
            <p className="text-sm text-gray-500 mt-1">Provide the details for your marketplace listing.</p>
          </div>

          <div className="col-span-full flex items-center gap-4">
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition" type="button" onClick={() => void generateInsight()} disabled={generatingInsight}>
              {generatingInsight ? "Generating..." : "Generate AI listing insight"}
            </button>
            <span className="text-sm text-gray-500">Creates an SEO-friendly description and a price suggestion from marketplace activity.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Product Name</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.name} onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Category</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.category} onChange={(e) => setDraft(prev => ({ ...prev, category: e.target.value }))} required />
            </label>

            {adminMode ? (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Assign to Seller</span>
                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.seller_id} onChange={(e) => setDraft(prev => ({ ...prev, seller_id: e.target.value }))}>
                  <option value="">Select Seller</option>
                  {businessmen.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Price (TZS)</span>
              <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.price} onChange={(e) => setDraft(prev => ({ ...prev, price: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Initial Stock</span>
              <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.stock} onChange={(e) => setDraft(prev => ({ ...prev, stock: e.target.value }))} required />
            </label>

            {!sellerMode ? (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Provider (Optional)</span>
                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.provider_id} onChange={(e) => setDraft(prev => ({ ...prev, provider_id: e.target.value }))}>
                  <option value="">Select Provider</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <label className="block col-span-full">
            <span className="text-sm font-medium text-gray-700">Detailed Description</span>
            <textarea className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.description} onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))} required />
          </label>

          <label className="block col-span-full">
            <span className="text-sm font-medium text-gray-700">Product Image</span>
            <div className="flex gap-4 mt-1">
              <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={handleImageUpload} disabled={uploadingImage} />
              <input type="text" placeholder="Or enter Image URL" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={draft.image_url} onChange={(e) => setDraft(prev => ({ ...prev, image_url: e.target.value }))} />
            </div>
          </label>

          {draft.image_url && (
            <div className="col-span-full">
              <img src={resolveImageUrl(draft.image_url)} alt="Preview" className="w-32 h-32 rounded-lg object-cover" />
            </div>
          )}

          {insight ? (
            <div className="col-span-full bg-blue-50 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">AI-powered product insight</h3>
                  <p className="text-sm text-gray-500">{insight.trend_summary || "Marketplace-based pricing guidance"}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {Math.round((insight.confidence || 0) * 100)}% confidence
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded p-4">
                  <span className="text-sm text-gray-500">Suggested price</span>
                  <strong className="block text-lg font-bold text-gray-900">{formatMoney(insight.suggested_price)}</strong>
                </div>
                <div className="bg-white rounded p-4">
                  <span className="text-sm text-gray-500">Expected range</span>
                  <strong className="block text-lg font-bold text-gray-900">{formatMoney(insight.price_range?.low)} - {formatMoney(insight.price_range?.high)}</strong>
                </div>
              </div>
              <p className="text-sm text-gray-600">{insight.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {insight.demand_level || "steady"} demand
                </span>
                {insight.seo_keywords?.map((keyword) => (
                  <span key={keyword} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="col-span-full flex gap-3">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium" type="submit">
              {editingId ? "Update Listing" : "Save Product"}
            </button>
            {editingId && <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      ) : null}

      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Search Catalog</span>
          <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name..." />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Category</span>
          <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Sort By</span>
          <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? <div className="bg-white rounded-lg shadow p-6 col-span-full">Loading catalog...</div> : null}
        {visibleProducts.map((product) => (
          <article key={product.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <img
              src={resolveImageUrl(product.image_url)}
              alt={product.name}
              className="w-full h-48 object-cover cursor-pointer"
              onClick={() => navigate(`/app/product/${product.id}`)}
            />
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-2">
                <div className="cursor-pointer flex-1" onClick={() => navigate(`/app/product/${product.id}`)}>
                  <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.category}</p>
                </div>
                <strong className="text-blue-600 font-bold">{formatMoney(product.price)}</strong>
              </div>
              <p className="text-sm text-gray-600 mb-3 flex-1 overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}} onClick={() => navigate(`/app/product/${product.id}`)}>{product.description}</p>
              {product.seller?.badges?.length ? (
                <div className="flex flex-wrap gap-1 mb-3">
                  {product.seller.badges.map((badge) => (
                    <span key={badge.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-auto">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.stock && product.stock > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {product.stock && product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
                <div className="flex gap-2">
                  {user?.role === "user" && (
                    <button
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
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
                      <button className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition" onClick={(e) => { e.stopPropagation(); beginEdit(product); }}>Edit</button>
                      <button className="px-3 py-1.5 bg-gray-200 text-red-600 text-sm rounded hover:bg-gray-300 transition" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!canManage(user?.role) ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Can&apos;t find what you need?</h2>
              <p className="text-sm text-gray-500 mt-1">Send a product request and let the marketplace recommend sellers or source options for you.</p>
            </div>
          </div>
          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitProductRequest}>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Company</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.company_name} onChange={(e) => setRequestDraft((prev) => ({ ...prev, company_name: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Contact name</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.contact_name} onChange={(e) => setRequestDraft((prev) => ({ ...prev, contact_name: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.email} onChange={(e) => setRequestDraft((prev) => ({ ...prev, email: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.phone} onChange={(e) => setRequestDraft((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Needed product</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.product_interest} onChange={(e) => setRequestDraft((prev) => ({ ...prev, product_interest: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Quantity</span>
              <input type="number" min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.quantity} onChange={(e) => setRequestDraft((prev) => ({ ...prev, quantity: e.target.value }))} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Target budget</span>
              <input className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.target_budget} onChange={(e) => setRequestDraft((prev) => ({ ...prev, target_budget: e.target.value }))} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Recommendation details</span>
              <textarea rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" value={requestDraft.notes} onChange={(e) => setRequestDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Tell sellers the type, brand, quality, or substitute you want." />
            </label>
            <div className="md:col-span-2">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium" type="submit">Request recommendations</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
