import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
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

  const sellerMode = String(user?.role || "") === "seller";
  const adminMode = ["admin", "super_admin", "owner"].includes(String(user?.role || ""));

  useEffect(() => {
    void load();
  }, [sellerMode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [productData, providerData, inventoryData] = await Promise.all([
        apiRequest<Product[]>("/products/"),
        apiRequest<Provider[]>("/providers/"),
        !adminMode && !sellerMode ? Promise.resolve(null) : apiRequest<InventoryStats>("/products/inventory/stats"),
      ]);
      setProducts(productData);
      setProviders(providerData);
      setInventory(inventoryData);

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
    setFlash("");
    setError("");
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

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      {canManage(user?.role) ? (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleCreateOrUpdate}>
          <div className="full-width">
            <h2>{editingId ? `Update Product #${editingId}` : "List New Product"}</h2>
            <p className="muted">Provide the details for your marketplace listing.</p>
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
          <article key={product.id} className="panel product-card-react" style={{ padding: '0', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/app/product/${product.id}`)}>
            <img src={resolveImageUrl(product.image_url)} alt={product.name} className="product-card-image" style={{ borderRadius: '0' }} />
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0' }}>{product.name}</h3>
                  <p className="muted" style={{ fontSize: '0.85rem' }}>{product.category}</p>
                </div>
                <strong style={{ color: 'var(--brand-blue)' }}>{formatMoney(product.price)}</strong>
              </div>
              <p className="muted" style={{ fontSize: '0.9rem', margin: '12px 0', height: '2.7rem', overflow: 'hidden' }}>{product.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <span className={`status-pill ${product.stock && product.stock > 0 ? "ok" : "danger"}`}>
                  {product.stock && product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
                {canManage(user?.role) && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); beginEdit(product); }}>Edit</button>
                    <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
