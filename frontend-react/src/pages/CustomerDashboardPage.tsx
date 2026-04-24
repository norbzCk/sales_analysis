import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { StatCards } from "../components/ui/PageSections";
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
  if (status === "Delivered") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (status === "Cancelled") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (status === "Pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
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
  const { cartCount } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);
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
      setLoading(true);
      setError("");
      const data = await apiRequest<Order[]>("/orders/");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Failed to load customer dashboard");
    } finally {
      setLoading(false);
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
    const cancelledOrders = orders.filter((order) => normalizeStatus(order.status) === "Cancelled").length;
    const totalSpend = orders.reduce((sum, order) => sum + orderTotal(order), 0);
    const totalUnits = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
    const averageOrderValue = orders.length ? totalSpend / orders.length : 0;
    return {
      totalOrders: orders.length,
      activeOrders,
      deliveredOrders,
      cancelledOrders,
      totalSpend,
      totalUnits,
      averageOrderValue,
    };
  }, [orders]);

  const statItems = useMemo(
    () => [
      { id: "orders-total", label: "Total Orders", value: summary.totalOrders, note: "Orders fetched from your account history." },
      { id: "orders-active", label: "Active Orders", value: summary.activeOrders, note: "Still moving through fulfillment." },
      { id: "orders-delivered", label: "Delivered", value: summary.deliveredOrders, note: "Successfully completed purchases." },
      { id: "spend-total", label: "Total Spend", value: formatMoney(summary.totalSpend), note: "Combined value of all recorded orders." },
      { id: "avg-order", label: "Average Order", value: formatMoney(summary.averageOrderValue), note: "Typical spend per checkout." },
      { id: "units-total", label: "Items Ordered", value: summary.totalUnits, note: "Total quantity purchased so far." },
    ],
    [summary],
  );

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
          label: `More ${category} sellers`,
          to: `/app/products?category=${encodeURIComponent(category)}`,
          detail: `Browse more products in ${category}.`,
        });
      }

      if (seller && !seen.has(`seller:${seller}`)) {
        seen.add(`seller:${seller}`);
        items.push({
          id: `seller:${seller}`,
          label: `More from ${seller}`,
          to: `/app/products?seller=${encodeURIComponent(seller)}`,
          detail: "See similar products from this seller.",
        });
      }
    }

    return items.slice(0, 4);
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
      <section className="p-8">
        <h1 className="text-2xl font-display font-extrabold">Customer dashboard</h1>
        <p className="text-slate-500 font-medium">This dashboard is only for customer accounts.</p>
      </section>
    );
  }

  return (
    <div className="space-y-10 p-4 md:p-8 animate-soft-enter">
      {/* Hero / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">Buyer Command Center</span>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">Welcome, {user?.name?.split(' ')[0] || "Customer"}</h1>
          <p className="text-slate-500 font-medium text-lg">Manage your orders, payments, and marketplace discovery.</p>
        </div>
        
      </div>

      <StatCards items={statItems} />

      {error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-bold flex items-center gap-3 border border-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex items-center gap-3 border border-emerald-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {flash}
        </div>
      ) : null}
      {loading ? <div className="glass-card p-6 text-slate-500 font-semibold">Refreshing your latest order stats...</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Tracking Card */}
        <div className="lg:col-span-2 space-y-8">
          <article className="glass-card p-8 space-y-8 overflow-hidden relative">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Order Lifecycle</span>
                <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Live Status</h2>
              </div>
              {currentOrder && (
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest
                  ${normalizeStatus(currentOrder.status) === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                    normalizeStatus(currentOrder.status) === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-brand/10 text-brand'}
                `}>
                  {normalizeStatus(currentOrder.status)}
                </span>
              )}
            </div>

            {currentOrder ? (
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{currentOrder.product || "Order"}</h3>
                    <p className="text-slate-500 font-medium">Sold by <span className="text-slate-900 font-bold">{currentOrder.provider_name || "Verified Seller"}</span></p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute top-2 left-0 w-full h-1 bg-slate-100 rounded-full" />
                  <div 
                    className="absolute top-2 left-0 h-1 bg-brand rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent(normalizeStatus(currentOrder.status))}%` }}
                  />
                  <div className="relative flex justify-between">
                    {lifecycleSteps.map((step) => {
                      const currentIndex = lifecycleSteps.indexOf(normalizeStatus(currentOrder.status) as (typeof lifecycleSteps)[number]);
                      const done = currentIndex >= 0 && lifecycleSteps.indexOf(step) <= currentIndex;
                      return (
                        <div key={step} className="flex flex-col items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-4 border-white shadow-sm z-10 transition-colors duration-500 
                            ${done ? 'bg-brand' : 'bg-slate-200'}
                          `} />
                          <span className={`text-[9px] font-black uppercase tracking-tight 
                            ${done ? 'text-brand' : 'text-slate-400'}
                          `}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-slate-400 font-bold">No active orders tracking</p>
              </div>
            )}
          </article>

          {/* History / Filtered List */}
          <article className="glass-card p-0 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-1 w-full md:w-auto">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Log</span>
                <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Order History</h2>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <input 
                    value={filterKeyword} 
                    onChange={(e) => setFilterKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-brand/20 focus:bg-white rounded-xl outline-none transition-all font-semibold text-sm"
                    placeholder="Search history..."
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-brand/20 focus:bg-white rounded-xl outline-none transition-all font-semibold text-sm appearance-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {!filteredOrders.length ? (
                <div className="p-12 text-center text-slate-400 font-bold">No orders found matching your search.</div>
              ) : (
                filteredOrders
                  .slice()
                  .sort((a, b) => new Date(orderDate(b) || 0).getTime() - new Date(orderDate(a) || 0).getTime())
                  .map((order) => {
                    const status = normalizeStatus(order.status);
                    const total = orderTotal(order);
                    return (
                      <div key={order.id} className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:bg-slate-50/50 transition-colors group">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                            #{order.id.toString().slice(-3)}
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-900 leading-none">{order.product || "Order Item"}</h4>
                            <p className="text-xs font-semibold text-slate-400">
                              {order.provider_name} • {formatDate(order.order_date)}
                            </p>
                            <p className="text-[10px] uppercase font-black tracking-widest text-brand/60">{order.category || "General"}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                          <div className="flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                            <span className="font-display font-black text-slate-900">{formatMoney(total)}</span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                            ${status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                              status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}
                          `}>
                            {status}
                          </span>
                          <Link 
                            to={`/app/payments?order_id=${order.id}&amount=${total}`}
                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-brand transition-all active:scale-95"
                          >
                            Pay Now
                          </Link>
                          {["Pending", "Confirmed"].includes(status) && (
                            <button 
                              onClick={() => void handleCancel(order.id)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </article>
        </div>

        {/* Sidebar / Recommendations */}
        <aside className="space-y-8">
          <article className="glass-card p-8 bg-brand-strong text-white border-none shadow-brand/20">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Fulfillment Hub</span>
                <h3 className="text-2xl font-display font-extrabold tracking-tight">Delivery Address</h3>
                <p className="text-white/60 text-sm font-medium leading-relaxed">
                  Your destination is set during the checkout process for maximum flexibility.
                </p>
              </div>

              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-xs font-bold text-white/90">
                  {currentOrder?.delivery_address || "No active delivery address stored."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Cart items</p>
                  <strong className="mt-2 block text-2xl font-display font-black">{cartCount}</strong>
                </div>
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Cancelled</p>
                  <strong className="mt-2 block text-2xl font-display font-black">{summary.cancelledOrders}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <Link to="/app/orders" className="w-full py-3 bg-white text-brand-strong text-sm font-bold rounded-xl text-center hover:bg-slate-50 transition-all">Create Order</Link>
                <Link to="/app/payments" className="w-full py-3 bg-white/10 text-white text-sm font-bold rounded-xl text-center hover:bg-white/20 transition-all border border-white/10">Manage Payments</Link>
              </div>
            </div>
          </article>

          <article className="glass-card p-8 space-y-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discover More</span>
              <h3 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Smart Suggestions</h3>
            </div>

            <div className="grid gap-3">
              {suggestions.length ? suggestions.map((item) => (
                <Link key={item.id} to={item.to} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-brand/20 hover:bg-white transition-all group">
                  <div className="flex justify-between items-center mb-1">
                    <strong className="text-sm font-bold text-slate-900 group-hover:text-brand transition-colors">{item.label}</strong>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{item.detail}</span>
                </Link>
              )) : (
                <Link to="/app/products" className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-3 hover:border-brand/40 hover:bg-white transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 group-hover:text-brand transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Explore Marketplace</span>
                </Link>
              )}
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
