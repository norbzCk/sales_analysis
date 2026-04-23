import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { apiRequest } from "../lib/http";
import type { Order } from "../types/domain";

const lifecycleSteps = ["Pending", "Confirmed", "Processing", "Dispatched", "In Transit", "Delivered"] as const;

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function normalizeStatus(value?: string | null) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "confirmed") return "Confirmed";
  if (status === "processing" || status === "packed" || status === "ready for shipping") return "Processing";
  if (status === "dispatched" || status === "shipped") return "Dispatched";
  if (status === "in transit" || status === "on the way") return "In Transit";
  if (status === "delivered" || status === "received") return "Delivered";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  return "Pending";
}

function statusTone(status: string) {
  if (status === "Delivered") return "buyer-badge buyer-badge--good";
  if (status === "Cancelled") return "buyer-badge buyer-badge--danger";
  if (status === "Pending") return "buyer-badge buyer-badge--warn";
  return "buyer-badge";
}

function progressPercent(status: string) {
  if (status === "Cancelled") return 8;
  const index = lifecycleSteps.indexOf(status as (typeof lifecycleSteps)[number]);
  return index >= 0 ? Math.max(12, Math.round(((index + 1) / lifecycleSteps.length) * 100)) : 12;
}

function orderTotal(order: Order) {
  return Number(order.total || Number(order.unit_price || 0) * Number(order.quantity || 0));
}

function orderDate(order: Order) {
  return order.order_date || null;
}

function orderCategory(order: Order) {
  return String(order.category || "General").trim() || "General";
}

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const { cart, cartCount } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const deferredFilterKeyword = useDeferredValue(filterKeyword);

  useEffect(() => {
    if (user?.role === "user") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      setError("");
      const data = await apiRequest<Order[]>("/orders/");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Failed to load customer dashboard");
    }
  }

  const categories = useMemo(() => {
    const values = Array.from(new Set(orders.map(orderCategory))).sort();
    return ["All", ...values];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = deferredFilterKeyword.trim().toLowerCase();
    return orders.filter((order) => {
      const categoryMatch = selectedCategory === "All" || orderCategory(order) === selectedCategory;
      const keywordMatch =
        !keyword ||
        `${order.product || ""} ${order.provider_name || ""} ${order.delivery_address || ""} ${orderCategory(order)}`
          .toLowerCase()
          .includes(keyword);
      return categoryMatch && keywordMatch;
    });
  }, [deferredFilterKeyword, orders, selectedCategory]);

  const summary = useMemo(() => {
    const activeOrders = orders.filter((order) => !["Delivered", "Cancelled"].includes(normalizeStatus(order.status))).length;
    const deliveredOrders = orders.filter((order) => normalizeStatus(order.status) === "Delivered").length;
    const totalSpend = orders.reduce((sum, order) => sum + orderTotal(order), 0);
    return {
      totalOrders: orders.length,
      activeOrders,
      deliveredOrders,
      totalSpend,
    };
  }, [orders]);

  const currentOrder = useMemo(() => {
    const sorted = [...orders].sort((left, right) => {
      const leftTime = new Date(orderDate(left) || 0).getTime();
      const rightTime = new Date(orderDate(right) || 0).getTime();
      return rightTime - leftTime;
    });
    return sorted.find((order) => !["Delivered", "Cancelled"].includes(normalizeStatus(order.status))) || sorted[0] || null;
  }, [orders]);

  const suggestions = useMemo(() => {
    const items: Array<{ id: string; label: string; to: string; detail: string }> = [];
    const seen = new Set<string>();

    for (const order of orders) {
      const category = orderCategory(order);
      const seller = String(order.provider_name || "").trim();

      if (category && !seen.has(`category:${category}`)) {
        seen.add(`category:${category}`);
        items.push({
          id: `category:${category}`,
          label: `View more ${category} sellers`,
          to: `/app/products?category=${encodeURIComponent(category)}`,
          detail: `Browse more products in ${category}.`,
        });
      }

      if (seller && !seen.has(`seller:${seller}`)) {
        seen.add(`seller:${seller}`);
        items.push({
          id: `seller:${seller}`,
          label: `View more from ${seller}`,
          to: `/app/products?seller=${encodeURIComponent(seller)}`,
          detail: "See similar products from this seller.",
        });
      }
    }

    return items.slice(0, 6);
  }, [orders]);

  async function handleCancel(orderId: number) {
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: "POST" });
      setFlash("Order cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  if (user?.role !== "user") {
    return (
      <section className="panel">
        <h1>Customer dashboard</h1>
        <p className="muted">This dashboard is only for customer accounts.</p>
      </section>
    );
  }

  return (
    <section className="panel-stack buyer-dashboard-live">
      <div className="panel buyer-hero">
        <div className="buyer-hero__grid">
          <div>
            <p className="eyebrow">Buyer account</p>
            <h1>Welcome back, {user?.name || "Customer"}</h1>
            <p className="muted">
              This dashboard only shows real orders, real spend, real cart items, and live delivery details.
            </p>
          </div>

          <div className="stat-grid hero-stats-grid">
            <article className="stat-card hero-stat-card">
              <span className="stat-label">Total orders</span>
              <strong>{summary.totalOrders}</strong>
            </article>
            <article className="stat-card hero-stat-card">
              <span className="stat-label">Active orders</span>
              <strong>{summary.activeOrders}</strong>
            </article>
            <article className="stat-card hero-stat-card">
              <span className="stat-label">Delivered</span>
              <strong>{summary.deliveredOrders}</strong>
            </article>
            <article className="stat-card hero-stat-card">
              <span className="stat-label">Cart items</span>
              <strong>{cartCount}</strong>
            </article>
          </div>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="buyer-section-grid">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Checkout facts</p>
              <h2>Delivery address is not auto-filled</h2>
            </div>
          </div>
          <p className="muted">
            Customers set the delivery address during the actual order process. The system no longer invents a default address.
          </p>
          {currentOrder?.delivery_address ? (
            <p className="muted">
              Current order destination: <strong>{currentOrder.delivery_address}</strong>
            </p>
          ) : (
            <p className="muted">No active delivery address is stored unless you entered one for a real order.</p>
          )}
          <div className="customer-link-list">
            <Link className="secondary-button" to="/app/orders">Create or manage orders</Link>
            <Link className="secondary-button" to="/app/payments">Pay only when ready</Link>
          </div>
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Seller suggestions</p>
              <h2>View similar sellers</h2>
            </div>
          </div>
          {suggestions.length ? (
            <div className="customer-link-list">
              {suggestions.map((item) => (
                <Link key={item.id} className="customer-link-card" to={item.to}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="customer-link-list">
              <Link className="customer-link-card" to="/app/products">
                <strong>Browse the marketplace</strong>
                <span>Explore verified products and sellers.</span>
              </Link>
            </div>
          )}
        </article>
      </div>

      <div className="buyer-section-grid buyer-section-grid--wide">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Current order lifecycle</p>
              <h2>Live status and progress</h2>
            </div>
            {currentOrder ? <span className={statusTone(normalizeStatus(currentOrder.status))}>{normalizeStatus(currentOrder.status)}</span> : null}
          </div>

          {currentOrder ? (
            <>
              <p>
                <strong>{currentOrder.product || "Order"}</strong> from {currentOrder.provider_name || "Marketplace seller"}
              </p>
              <div className="buyer-progress-bar" style={{ height: '8px', background: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div
                  className="buyer-progress-bar__fill"
                  style={{ width: `${progressPercent(normalizeStatus(currentOrder.status))}%`, height: '100%', background: 'var(--brand-blue)', transition: 'width 0.3s ease' }}
                />
              </div>
              <div className="buyer-status-track">
                {lifecycleSteps.map((step) => {
                  const currentIndex = lifecycleSteps.indexOf(normalizeStatus(currentOrder.status) as (typeof lifecycleSteps)[number]);
                  const done = currentIndex >= 0 && lifecycleSteps.indexOf(step) <= currentIndex;
                  return (
                    <div key={step} className={`buyer-status-step${done ? " buyer-status-step--done" : ""}`}>
                      <strong>{step}</strong>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="buyer-empty">No active order timeline available yet.</p>
          )}
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Order summary</p>
              <h2>Only real totals</h2>
            </div>
          </div>
          <div className="panel-stack">
            <div className="buyer-kpi">
              <span className="muted">Total spend</span>
              <strong>{formatMoney(summary.totalSpend)}</strong>
            </div>
            <div className="buyer-kpi">
              <span className="muted">Cart items</span>
              <strong>{cart.length}</strong>
            </div>
            <div className="buyer-kpi">
              <span className="muted">Payment step</span>
              <strong>Starts only when you choose to pay</strong>
            </div>
          </div>
        </article>
      </div>

      <article className="panel buyer-card">
        <div className="buyer-card__header">
          <div>
            <p className="eyebrow">Order history</p>
            <h2>Recent purchases and next actions</h2>
          </div>
        </div>

        <div className="panel filter-grid">
          <label>
            Search
            <input value={filterKeyword} onChange={(event) => setFilterKeyword(event.target.value)} placeholder="Search product, seller, or address" />
          </label>
          <label>
            Category
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="customer-order-list">
          {!filteredOrders.length ? (
            <p className="buyer-empty">No real orders match the current filter.</p>
          ) : (
            filteredOrders
              .slice()
              .sort((left, right) => new Date(orderDate(right) || 0).getTime() - new Date(orderDate(left) || 0).getTime())
              .map((order) => {
                const normalized = normalizeStatus(order.status);
                const total = orderTotal(order);
                const canCancel = ["Pending", "Confirmed"].includes(normalized);
                return (
                  <div key={order.id} className="customer-order-item">
                    <div>
                      <strong>#{order.id} · {order.product || "Order"}</strong>
                      <p className="muted">
                        {order.provider_name || "Marketplace seller"} · {formatDate(order.order_date)} · Qty {Number(order.quantity || 0)}
                      </p>
                      <p className="muted">
                        Delivery: {order.delivery_address || "Not set yet"} · {order.delivery_method || "Standard"}
                      </p>
                    </div>
                    <div className="customer-order-actions">
                      <span className={statusTone(normalized)}>{normalized}</span>
                      <strong>{formatMoney(total)}</strong>
                      <Link className="secondary-button" to={`/app/payments?order_id=${order.id}&amount=${total}`}>
                        Pay for this order
                      </Link>
                      <Link className="secondary-button" to={`/app/products?category=${encodeURIComponent(orderCategory(order))}`}>
                        Similar sellers
                      </Link>
                      {canCancel ? (
                        <button type="button" className="secondary-button customer-danger-button" onClick={() => void handleCancel(order.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </article>
    </section>
  );
}
