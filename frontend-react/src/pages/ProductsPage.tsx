import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
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
}

const emptyDraft: ProductDraft = {
  name: "",
  category: "",
  price: "",
  stock: "",
  description: "",
  image_url: "",
  provider_id: "",
};

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function canManage(role?: string) {
  return ["admin", "super_admin", "owner", "seller"].includes(String(role || ""));
}

function stockLabel(stock?: number) {
  const units = Number(stock || 0);
  if (units <= 0) return "Out of stock";
  if (units < 5) return "Low stock";
  return "In stock";
}

function stockClass(stock?: number) {
  const units = Number(stock || 0);
  if (units <= 0) return "danger";
  if (units < 5) return "warn";
  return "ok";
}

export function ProductsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [inventory, setInventory] = useState<InventoryStats | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [providerId, setProviderId] = useState("all");
  const [sort, setSort] = useState("featured");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState("");

  const sellerMode = String(user?.role || "") === "seller";

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
        apiRequest<InventoryStats>("/products/inventory/stats"),
      ]);
      setProducts(productData);
      setProviders(providerData);
      setInventory(inventoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
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
    if (providerId !== "all") {
      data = data.filter((item) => String(item.provider_id || "") === providerId);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) => `${item.name || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase().includes(q));
    }
    if (sort === "price_low") data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === "price_high") data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sort === "stock_high") data.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    if (sort === "featured") data.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    return data;
  }, [category, products, providerId, search, sort]);

  function resetForm() {
    setDraft(emptyDraft);
    setEditingId(null);
  }

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
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    };

    if (!payload.name || !payload.category || payload.price <= 0 || payload.stock < 0 || !payload.description) {
      setError("Please provide valid product name, category, price, stock, and description.");
      return;
    }

    try {
      if (editingId) {
        await apiRequest(`/products/${editingId}`, { method: "PUT", body: payload });
        setFlash("Product updated.");
      } else {
        await apiRequest("/products/", { method: "POST", body: payload });
        setFlash("Product added.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Deactivate this product listing?")) return;
    setError("");
    setFlash("");
    try {
      await apiRequest(`/products/${id}`, { method: "DELETE" });
      setFlash("Product deactivated.");
      if (editingId === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate product");
    }
  }

  function parseBulkRows(raw: string) {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.map((line, index) => {
      const parts = line.split(",").map((item) => item.trim());
      const [name = "", categoryValue = "", price = "", stock = "", description = "", image_url = ""] = parts;
      return {
        index,
        item: {
          name,
          category: categoryValue,
          price: Number(price || 0),
          stock: Number(stock || 0),
          description,
          image_url: image_url || null,
        },
      };
    });
  }

  async function handleBulkUpload() {
    setError("");
    setFlash("");
    const rows = parseBulkRows(bulkRows);
    if (!rows.length) {
      setError("Add at least one product row before uploading.");
      return;
    }

    const items = rows.map((entry) => entry.item);
    try {
      const result = await apiRequest<{ created_count: number; skipped: Array<{ index: number; reason: string }> }>("/business/products/bulk", {
        method: "POST",
        body: { items },
      });
      setFlash(`Bulk upload complete. Created: ${result.created_count}, Skipped: ${result.skipped.length}.`);
      setBulkRows("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload products in bulk");
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Products</p>
        <h1>{sellerMode ? "Seller product and inventory management" : "Catalog management and product browsing"}</h1>
        <p className="muted">
          {sellerMode
            ? "Add products, update prices in real time, manage stock states, and upload multiple items in one batch."
            : "Browse products, apply filters, and manage catalog data from the unified marketplace."}
        </p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      {inventory ? (
        <div className="stat-grid">
          <article className="stat-card"><span className="stat-label">Products</span><strong>{inventory.total_products}</strong></article>
          <article className="stat-card"><span className="stat-label">Low stock</span><strong>{inventory.low_stock_count}</strong></article>
          <article className="stat-card"><span className="stat-label">Out of stock</span><strong>{inventory.out_of_stock_count}</strong></article>
          <article className="stat-card"><span className="stat-label">Inventory value</span><strong>{formatMoney(inventory.total_value)}</strong></article>
        </div>
      ) : null}

      {canManage(user?.role) ? (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleCreateOrUpdate}>
          <h2>{editingId ? `Edit product #${editingId}` : "Create product"}</h2>
          <label>Product name<input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} required /></label>
          <label>Category<input value={draft.category} onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))} required /></label>
          <label>Price<input value={draft.price} onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))} type="number" min="0" step="0.01" required /></label>
          <label>Stock<input value={draft.stock} onChange={(event) => setDraft((prev) => ({ ...prev, stock: event.target.value }))} type="number" min="0" required /></label>
          <label className="full-width">Description<textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} required /></label>
          <label>Image URL<input value={draft.image_url} onChange={(event) => setDraft((prev) => ({ ...prev, image_url: event.target.value }))} /></label>
          {!sellerMode ? (
            <label>
              Provider
              <select value={draft.provider_id} onChange={(event) => setDraft((prev) => ({ ...prev, provider_id: event.target.value }))}>
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="hero-actions">
            <button className="primary-button" type="submit">{editingId ? "Update product" : "Save product"}</button>
            {editingId ? <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button> : null}
          </div>
        </form>
      ) : null}

      {sellerMode ? (
        <article className="panel form-grid">
          <h2>Bulk upload products</h2>
          <p className="muted">Use one row per product in this format: `name, category, price, stock, description, image_url`.</p>
          <textarea
            rows={5}
            value={bulkRows}
            onChange={(event) => setBulkRows(event.target.value)}
            placeholder={"Sugar 50kg, Groceries, 75000, 20, Refined sugar bag, https://example.com/sugar.jpg\nCooking Oil 1L, Groceries, 5200, 80, Premium sunflower oil, https://example.com/oil.jpg"}
          />
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={handleBulkUpload}>Upload products in bulk</button>
          </div>
        </article>
      ) : null}

      <div className="panel filter-grid">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item === "all" ? "All categories" : item}</option>)}
          </select>
        </label>
        {!sellerMode ? (
          <label>
            Provider
            <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              <option value="all">All providers</option>
              {providers.map((provider) => <option key={provider.id} value={String(provider.id)}>{provider.name}</option>)}
            </select>
          </label>
        ) : null}
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price_low">Price low</option>
            <option value="price_high">Price high</option>
            <option value="stock_high">Stock high</option>
          </select>
        </label>
      </div>

      <div className="catalog-grid">
        {loading ? <div className="panel">Loading products...</div> : null}
        {!loading && !visibleProducts.length ? <div className="panel">No products found.</div> : null}
        {visibleProducts.map((product) => (
          <article key={product.id} className="panel product-card-react">
            <img className="product-card-image" src={product.image_url || FALLBACK_IMAGE} alt={product.name} />
            <div className="stack-list">
              <div>
                <h2>{product.name}</h2>
                <p className="muted">{product.category || "General"}</p>
              </div>
              <p className="muted">{product.description || "No description"}</p>
              <div className="two-up">
                <span>{formatMoney(product.price)}</span>
                <span className={`status-pill ${stockClass(product.stock)}`}>{stockLabel(product.stock)} ({product.stock || 0})</span>
              </div>
              <p className="muted">{product.provider?.name || "Independent seller"}</p>
              <div className="hero-actions">
                {user?.role === "user" ? (
                  <button className="primary-button" onClick={() => navigate(`/app/orders?product=${product.id}`)} type="button">
                    Order
                  </button>
                ) : null}
                {canManage(user?.role) ? (
                  <>
                    <button className="secondary-button" onClick={() => beginEdit(product)} type="button">
                      Edit
                    </button>
                    <button className="secondary-button" onClick={() => handleDelete(product.id)} type="button">
                      Deactivate
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
