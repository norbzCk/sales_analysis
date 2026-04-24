import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery, Order, OrderTracking, Product } from "../types/domain";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const TRACKING_STEPS = ["Pending", "Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received"];
const STATUS_OPTIONS = ["Pending", "Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received", "Cancelled"];

interface LogisticsOption {
  id: number;
  name: string;
  vehicle_type?: string | null;
  base_area?: string | null;
  status?: string | null;
  availability?: string | null;
  verification_status?: string | null;
}

interface BusinessmanOption {
  id: number;
  business_name: string;
}

interface DraftOrderItem {
  id: string;
  product_id: number;
  product_name: string;
  seller_name: string;
  quantity: number;
  unit_price: number;
  order_date: string;
  delivery_address: string;
  delivery_phone: string;
  delivery_method: string;
  delivery_notes: string;
}

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function normalizedStatus(value?: string | null) {
  const status = String(value || "").trim();
  if (status === "Delivered") return "Received";
  if (STATUS_OPTIONS.includes(status)) return status;
  return "Pending";
}

function canAdmin(role?: string) {
  return ["admin", "super_admin", "owner"].includes(String(role || ""));
}

function canSellerManage(role?: string) {
  return String(role || "") === "seller";
}

function findNextSellerStatus(current: string) {
  if (current === "Confirmed") return "Packed";
  if (current === "Packed") return "Ready For Shipping";
  if (current === "Ready For Shipping") return "Shipped";
  return "";
}

function statusVariant(status?: string) {
  const normalized = normalizedStatus(status);
  if (["Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received"].includes(normalized)) return "ok";
  if (normalized === "Cancelled") return "danger";
  return "warn";
}

function formatOrderDate(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function OrdersPage() {
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [logistics, setLogistics] = useState<LogisticsOption[]>([]);
  const [businessmen, setBusinessmen] = useState<BusinessmanOption[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [statusReasonByOrder, setStatusReasonByOrder] = useState<Record<number, string>>({});
  const [assignLogisticsByOrder, setAssignLogisticsByOrder] = useState<Record<number, string>>({});
  const [assignPickupByOrder, setAssignPickupByOrder] = useState<Record<number, string>>({});
  const [assignDestinationByOrder, setAssignDestinationByOrder] = useState<Record<number, string>>({});
  const [assignPriceByOrder, setAssignPriceByOrder] = useState<Record<number, string>>({});
  const [assignInstructionsByOrder, setAssignInstructionsByOrder] = useState<Record<number, string>>({});
  const [assignBusinessByOrder, setAssignBusinessByOrder] = useState<Record<number, string>>({});
  const [draftOrders, setDraftOrders] = useState<DraftOrderItem[]>([]);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [trackingError, setTrackingError] = useState("");

  const sellerMode = canSellerManage(user?.role);
  const draftStorageKey = `orders_draft_${user?.id || "guest"}`;

  useEffect(() => {
    void load();
  }, [sellerMode]);

  useEffect(() => {
    if (user?.role !== "user") return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) {
        setDraftOrders([]);
        return;
      }
      const parsed = JSON.parse(raw) as DraftOrderItem[];
      setDraftOrders(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDraftOrders([]);
    }
  }, [draftStorageKey, user?.role]);

  useEffect(() => {
    if (user?.role !== "user") return;
    localStorage.setItem(draftStorageKey, JSON.stringify(draftOrders));
  }, [draftOrders, draftStorageKey, user?.role]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (sellerMode) {
        const [orderData, deliveryData] = await Promise.all([
          apiRequest<{ items: Order[] }>("/business/orders"),
          apiRequest<{ items: LogisticsDelivery[] }>("/business/deliveries"),
        ]);
        setOrders(orderData.items || []);
        setDeliveries(deliveryData.items || []);
        setProducts([]);
      } else {
        const [orderData, productData] = await Promise.all([
          apiRequest<Order[]>("/orders/"),
          apiRequest<Product[]>("/products/"),
        ]);
        setOrders(orderData);
        setProducts(productData);
        setDeliveries([]);
      }

      const requestedProduct = Number(params.get("product") || 0);
      if (requestedProduct) {
        setSelectedId((current) => current || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }

    if (sellerMode) {
      try {
        const [logisticsData, businessData] = await Promise.all([
          apiRequest<{ items: LogisticsOption[] }>("/business/logistics-options"),
          apiRequest<{ items: BusinessmanOption[] }>("/business/", { auth: false }),
        ]);
        setLogistics(logisticsData.items || []);
        setBusinessmen(businessData.items || []);
      } catch {
        setLogistics([]);
        setBusinessmen([]);
      }
    }
  }

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const haystack = `${order.product || ""} ${order.category || ""} ${order.provider_name || ""} ${order.delivery_address || ""}`.toLowerCase();
      const okText = !q || haystack.includes(q);
      const okStatus = statusFilter === "all" || normalizedStatus(order.status) === statusFilter;
      return okText && okStatus;
    });
  }, [orders, search, statusFilter]);

  const selectedOrder = visibleOrders.find((item) => item.id === selectedId) || visibleOrders[0] || null;

  useEffect(() => {
    if (!selectedId && visibleOrders.length) {
      setSelectedId(visibleOrders[0].id);
    }
  }, [selectedId, visibleOrders]);

  // Calculate order status distribution for pie chart
  const orderStatusData = useMemo(() => {
    const statusCounts = STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<string, number>);

    orders.forEach((order) => {
      const status = normalizedStatus(order.status);
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const colors = [
      '#ef4444', // red - cancelled
      '#f97316', // orange - pending
      '#eab308', // yellow - confirmed
      '#22c55e', // green - packed
      '#3b82f6', // blue - ready for shipping
      '#8b5cf6', // purple - shipped
      '#06b6d4', // cyan - received
    ];

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length).map(color => color.replace('0.8', '1')),
        borderWidth: 2,
      }],
    };
  }, [orders]);

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} orders (${percentage}%)`;
          },
        },
      },
    },
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function loadTracking() {
      if (!selectedOrder || user?.role !== "user") {
        setTracking(null);
        setTrackingError("");
        return;
      }
      const status = normalizedStatus(selectedOrder.status);
      if (!["Ready For Shipping", "Shipped", "Received"].includes(status)) {
        setTracking(null);
        setTrackingError("");
        return;
      }
      try {
        const data = await apiRequest<OrderTracking>(`/orders/${selectedOrder.id}/tracking`);
        if (!cancelled) {
          setTracking(data);
          setTrackingError("");
        }
        if (!cancelled && ["assigned", "picked_up", "in_transit"].includes(String(data.status || "").toLowerCase())) {
          timer = window.setTimeout(() => void loadTracking(), 20000);
        }
      } catch (err) {
        if (!cancelled) {
          setTracking(null);
          setTrackingError(err instanceof Error ? err.message : "Tracking unavailable");
        }
      }
    }

    void loadTracking();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedOrder, user?.role]);

  const deliveryByOrderId = useMemo(() => {
    const map = new Map<number, LogisticsDelivery>();
    for (const item of deliveries) {
      if (item.order_id) {
        map.set(Number(item.order_id), item);
      }
    }
    return map;
  }, [deliveries]);

  const orderSummary = useMemo(() => {
    const counts = orders.reduce((summary, order) => {
      const status = normalizedStatus(order.status);
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    return {
      total: orders.length,
      pending: counts.Pending || 0,
      confirmed: counts.Confirmed || 0,
      packing: counts.Packed || 0,
      shipping: counts["Ready For Shipping"] || 0,
      shipped: counts.Shipped || 0,
      received: counts.Received || 0,
      cancelled: counts.Cancelled || 0,
    };
  }, [orders]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product_id = Number(form.get("product_id"));
    const quantity = Number(form.get("quantity") || 0);
    const product = products.find((item) => item.id === product_id);
    if (!product || quantity <= 0) {
      setError("Select a product and quantity greater than zero.");
      return;
    }

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      product_id,
      product_name: product.name || `Product #${product_id}`,
      seller_name: product.seller_name || product.seller?.business_name || product.provider?.name || "Marketplace seller",
      quantity,
      unit_price: Number(product.price || 0),
      order_date: String(form.get("order_date") || ""),
      delivery_address: String(form.get("delivery_address") || "").trim(),
      delivery_phone: String(form.get("delivery_phone") || "").trim(),
      delivery_method: String(form.get("delivery_method") || "Standard"),
      delivery_notes: String(form.get("delivery_notes") || "").trim(),
    };

    if (payload.delivery_method !== "Pickup" && !payload.delivery_address) {
      setError("Enter a real delivery address before saving the order.");
      return;
    }

    setDraftOrders((prev) => [...prev, payload]);
    setFlash("Order added to temporary list. Confirm when ready.");
    event.currentTarget.reset();
  }

  function removeDraftItem(id: string) {
    setDraftOrders((prev) => prev.filter((item) => item.id !== id));
  }

  function importCartToDrafts() {
    if (!cart.length) {
      setError("Your cart is empty.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const imported: DraftOrderItem[] = cart.map((item) => ({
      id: `cart-${item.id}-${Date.now()}`,
      product_id: item.id,
      product_name: item.name,
      seller_name: item.seller_name || "Marketplace seller",
      quantity: item.qty,
      unit_price: item.price,
      order_date: today,
      delivery_address: "",
      delivery_phone: user?.phone || "",
      delivery_method: "Standard",
      delivery_notes: "",
    }));
    setDraftOrders((prev) => [...prev, ...imported]);
    clearCart();
    setFlash(`${imported.length} cart item(s) moved into your temporary order list.`);
  }

  async function confirmDraftOrders() {
    if (!draftOrders.length) {
      setError("Add at least one order before confirming.");
      return;
    }
    setError("");
    setFlash("");

    let created = 0;
    const failures: string[] = [];

    for (const item of draftOrders) {
      try {
        if (item.delivery_method !== "Pickup" && !item.delivery_address.trim()) {
          failures.push(`${item.product_name}: delivery address is required`);
          continue;
        }
        await apiRequest("/orders/", {
          method: "POST",
          body: {
            product_id: item.product_id,
            quantity: item.quantity,
            order_date: item.order_date,
            delivery_address: item.delivery_address,
            delivery_phone: item.delivery_phone,
            delivery_method: item.delivery_method,
            delivery_notes: item.delivery_notes,
          },
        });
        created += 1;
      } catch (err) {
        failures.push(`${item.product_name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    if (created) {
      setDraftOrders([]);
      localStorage.removeItem(draftStorageKey);
      await load();
    }
    if (failures.length) {
      setError(`Some orders failed: ${failures.join(" | ")}`);
    }
    setFlash(created ? `${created} order(s) confirmed successfully.` : "No orders were confirmed.");
  }

  async function updateStatus(orderId: number, status: string) {
    try {
      await apiRequest(`/orders/${orderId}/status`, { method: "PATCH", body: { status } });
      setFlash(`Order moved to ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  async function cancelOrder(orderId: number) {
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: "POST" });
      setFlash("Order cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  async function receiveOrder(orderId: number) {
    try {
      await apiRequest(`/orders/${orderId}/receive`, { method: "POST" });
      setFlash("Order marked received.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm receipt");
    }
  }

  async function rateOrder(orderId: number, rating: number) {
    try {
      await apiRequest(`/orders/${orderId}/rating`, { method: "POST", body: { rating } });
      setFlash("Rating submitted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    }
  }

  async function sellerDecision(orderId: number, decision: "accept" | "reject") {
    try {
      await apiRequest(`/business/orders/${orderId}/decision`, {
        method: "PATCH",
        body: {
          decision,
          reason: statusReasonByOrder[orderId] || null,
        },
      });
      setFlash(`Order ${decision === "accept" ? "accepted" : "rejected"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record order decision");
    }
  }

  async function sellerProgressStatus(orderId: number, status: string) {
    if (!status) return;
    try {
      await apiRequest(`/business/orders/${orderId}/status`, {
        method: "PATCH",
        body: {
          status,
          reason: statusReasonByOrder[orderId] || null,
        },
      });
      setFlash(`Order moved to ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update seller order status");
    }
  }

  async function sellerCancel(orderId: number) {
    try {
      await apiRequest(`/business/orders/${orderId}/status`, {
        method: "PATCH",
        body: {
          status: "Cancelled",
          reason: statusReasonByOrder[orderId] || "Cancelled by seller",
        },
      });
      setFlash("Order cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel seller order");
    }
  }

  async function assignDelivery(order: Order) {
    if (!order.id) return;
    const logisticsId = Number(assignLogisticsByOrder[order.id] || 0) || null;
    const businessmanId = Number(assignBusinessByOrder[order.id] || 0) || null;
    try {
      await apiRequest(`/business/orders/${order.id}/assign-delivery`, {
        method: "POST",
        body: {
          seller_id: businessmanId,
          logistics_id: logisticsId,
          pickup_location: assignPickupByOrder[order.id] || null,
          delivery_location: assignDestinationByOrder[order.id] || order.delivery_address || null,
          price: assignPriceByOrder[order.id] ? Number(assignPriceByOrder[order.id]) : null,
          special_instructions: assignInstructionsByOrder[order.id] || null,
        },
      });
      setFlash("Delivery assigned.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign delivery");
    }
  }

  function renderSellerActions(order: Order) {
    if (!order.id) return null;
    const status = normalizedStatus(order.status);
    const nextStatus = findNextSellerStatus(status);
    const assignedDelivery = deliveryByOrderId.get(order.id);

    return (
      <div className="stack-list">
        <label>
          Seller note or reason
          <input
            value={statusReasonByOrder[order.id] || ""}
            onChange={(event) =>
              setStatusReasonByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
            }
            placeholder="Reason for decision or status update"
          />
        </label>

        {status === "Pending" ? (
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={() => sellerDecision(order.id!, "accept")}>
              Accept order
            </button>
            <button className="secondary-button" type="button" onClick={() => sellerDecision(order.id!, "reject")}>
              Reject order
            </button>
          </div>
        ) : null}

        {nextStatus ? (
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={() => sellerProgressStatus(order.id!, nextStatus)}>
              Move to {nextStatus}
            </button>
            {["Confirmed", "Packed", "Ready For Shipping"].includes(status) ? (
              <button className="secondary-button" type="button" onClick={() => sellerCancel(order.id!)}>
                Cancel order
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="panel panel-compact">
          <div className="panel-header">
            <strong>Delivery assignment</strong>
            <span>{assignedDelivery ? `Delivery #${assignedDelivery.id} (${assignedDelivery.status})` : "Not assigned yet"}</span>
          </div>
          <div className="form-grid auth-form-two-col">
            <label>
              Businessman
              <select
                value={assignBusinessByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignBusinessByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
              >
                <option value="">Current seller ({order.provider_name || "Business"})</option>
                {businessmen.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.business_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Logistics partner
              <select
                value={assignLogisticsByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignLogisticsByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
              >
                <option value="">Auto assign (Recommended)</option>
                {logistics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.vehicle_type ? ` (${item.vehicle_type})` : ""}
                    {item.status ? ` · ${item.status}` : ""}
                    {item.availability ? ` / ${item.availability}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pickup location
              <input
                value={assignPickupByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignPickupByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
                placeholder="Seller pickup point"
              />
            </label>
            <label>
              Delivery location
              <input
                value={assignDestinationByOrder[order.id] || order.delivery_address || ""}
                onChange={(event) =>
                  setAssignDestinationByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
                placeholder="Customer address"
              />
            </label>
            <label>
              Delivery price
              <input
                type="number"
                min="0"
                step="0.01"
                value={assignPriceByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignPriceByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
                placeholder="Optional delivery fee"
              />
            </label>
            <label className="full-width">
              Special instructions
              <textarea
                rows={3}
                value={assignInstructionsByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignInstructionsByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
                placeholder="Landmark, urgency, handling notes"
              />
            </label>
            <div className="hero-actions">
              <button className="secondary-button" type="button" onClick={() => assignDelivery(order)}>
                {assignedDelivery ? "Reassign delivery" : "Assign delivery"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const draftSummary = useMemo(() => {
    const total = draftOrders.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const units = draftOrders.reduce((sum, item) => sum + item.quantity, 0);
    return { total, units };
  }, [draftOrders]);

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Orders</p>
        <h1>{sellerMode ? "Seller order operations" : "Ordering and status tracking"}</h1>
        <p className="muted">
          {sellerMode
            ? "Receive customer orders instantly, accept/reject with reasons, progress fulfillment stages, and coordinate deliveries."
            : "Create, track, and manage customer orders with delivery status and ratings."}
        </p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Total orders</span><strong>{orderSummary.total}</strong></article>
        <article className="stat-card"><span className="stat-label">Pending</span><strong>{orderSummary.pending}</strong></article>
        <article className="stat-card"><span className="stat-label">In progress</span><strong>{orderSummary.packing + orderSummary.shipping}</strong></article>
        <article className="stat-card"><span className="stat-label">Delivered</span><strong>{orderSummary.received}</strong></article>
      </div>

      {/* Orders Status Pie Chart */}
      <div className="panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Orders by Status</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Distribution of orders across different fulfillment stages</p>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Pie data={orderStatusData} options={pieChartOptions} />
          </div>
        </div>
      </div>

      {user?.role === "user" ? (
        <div className="two-column-grid">
          <form className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4" onSubmit={handleCreate}>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-4">Add order to temporary list</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Product</span>
                <select name="product_id" defaultValue={params.get("product") || ""} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" required>
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {formatMoney(product.price)} ({product.seller_name || product.seller?.business_name || "seller"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</span>
                <input name="quantity" type="number" min="1" defaultValue={params.get("quantity") || "1"} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" required />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Order date</span>
                <input name="order_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery method</span>
                <select name="delivery_method" defaultValue="Standard" className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="Standard">Standard</option>
                  <option value="Express">Express</option>
                  <option value="Pickup">Pickup</option>
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery address</span>
                <input name="delivery_address" placeholder="Enter the actual delivery address" className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery phone</span>
                <input name="delivery_phone" defaultValue={user?.phone || ""} placeholder="Phone for delivery contact" className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
                <input name="delivery_notes" placeholder="Optional delivery instructions" className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
              </label>
            </div>
            <button className="w-full px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-strong transition font-medium" type="submit">Save temporarily</button>
          </form>

          <article className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Temporary order list</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{draftOrders.length} item(s)</span>
                <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" type="button" onClick={importCartToDrafts}>
                  Import cart ({cart.length})
                </button>
              </div>
            </div>
            {!draftOrders.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No temporary orders yet.</p> : null}
            <div className="space-y-3">
              {draftOrders.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <strong className="text-slate-900 dark:text-white">{item.product_name}</strong>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.seller_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Qty {item.quantity} · {item.delivery_method}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="text-slate-900 dark:text-white">{formatMoney(item.unit_price * item.quantity)}</strong>
                    <button className="px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium" type="button" onClick={() => removeDraftItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {draftOrders.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">Units: {draftSummary.units}</span>
                <div className="flex items-center gap-3">
                  <strong className="text-lg text-slate-900 dark:text-white">Total: {formatMoney(draftSummary.total)}</strong>
                  <button className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-strong transition font-medium" type="button" onClick={() => void confirmDraftOrders()} disabled={!draftOrders.length}>
                    Confirm order(s)
                  </button>
                </div>
              </div>
            )}
          </article>
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders" className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-brand focus:ring-brand bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {visibleOrders.length} orders matching current filters
            </div>
          </div>
        </div>
      </div>

      <div className="two-column-grid">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Order list</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{visibleOrders.length} orders matching current filters.</p>
            </div>
            <span className="px-3 py-1 bg-brand/10 text-brand rounded-full text-sm font-medium">{visibleOrders.length}</span>
          </div>
          <div className="space-y-2">
            {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading orders...</p> : null}
            {!loading && !visibleOrders.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No orders found.</p> : null}
            {visibleOrders.map((order) => (
              <button
                key={order.id}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedOrder?.id === order.id
                    ? "border-brand bg-brand/5 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
                onClick={() => setSelectedId(order.id)}
                type="button"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <strong className="text-slate-900 dark:text-white">#{order.id} {order.product || "Order"}</strong>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{order.provider_name || "Customer order"}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatOrderDate(order.order_date || (order as any).created_at || null)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      statusVariant(order.status || undefined) === "ok"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : statusVariant(order.status || undefined) === "warn"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {normalizedStatus(order.status)}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formatMoney(order.total || (Number(order.unit_price || 0) * Number(order.quantity || 0)))}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          {!selectedOrder ? <p className="text-sm text-slate-500 dark:text-slate-400">Select an order to inspect it.</p> : (
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Order details</p>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">#{selectedOrder.id} {selectedOrder.product || "-"}</h2>
                <p className="text-slate-500 dark:text-slate-400">{selectedOrder.category || "General"} · {selectedOrder.provider_name || "Provider unavailable"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Quantity</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedOrder.quantity || 0}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatMoney(selectedOrder.total || (Number(selectedOrder.unit_price || 0) * Number(selectedOrder.quantity || 0)))}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Delivery</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedOrder.delivery_method || "Standard"}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{normalizedStatus(selectedOrder.status)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Address:</strong> {selectedOrder.delivery_address || "No address"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Phone:</strong> {selectedOrder.delivery_phone || "-"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Customer:</strong> {selectedOrder.created_by || "-"}</p>
                {selectedOrder.status_reason ? <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Reason:</strong> {selectedOrder.status_reason}</p> : null}
              </div>

              <div className="tracking-steps-react">
                {TRACKING_STEPS.map((step) => (
                  <div
                    key={step}
                    className={`tracking-step-react${
                      TRACKING_STEPS.indexOf(step) <= TRACKING_STEPS.indexOf(normalizedStatus(selectedOrder.status)) &&
                      normalizedStatus(selectedOrder.status) !== "Cancelled"
                        ? " done"
                        : ""
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>

              {user?.role === "user" ? (
                <div className="panel tracking-map-card">
                  <div className="panel-header">
                    <div>
                      <strong>Real-time delivery map</strong>
                      <p className="muted">Live route view during the in-transit phase.</p>
                    </div>
                    {tracking ? <span className="buyer-badge buyer-badge--good">{tracking.progress_percent}% complete</span> : null}
                  </div>
                  {tracking ? (
                    <div className="tracking-map-grid">
                      <div className="tracking-map-canvas">
                        <div className="tracking-map-route" />
                        <div className="tracking-map-route tracking-map-route--accent" />
                        <div className="tracking-map-marker tracking-map-marker--pickup" style={{ left: "10%", top: "72%" }}>
                          <span>P</span>
                        </div>
                        <div
                          className="tracking-map-marker tracking-map-marker--current"
                          style={{
                            left: `${10 + ((tracking.progress_percent || 0) * 0.74)}%`,
                            top: `${72 - ((tracking.progress_percent || 0) * 0.36)}%`,
                          }}
                        >
                          <span>R</span>
                        </div>
                        <div className="tracking-map-marker tracking-map-marker--dropoff" style={{ left: "84%", top: "18%" }}>
                          <span>D</span>
                        </div>
                        <div className="tracking-map-label tracking-map-label--pickup">{tracking.map.pickup.label}</div>
                        <div className="tracking-map-label tracking-map-label--current">{tracking.map.current.label}</div>
                        <div className="tracking-map-label tracking-map-label--dropoff">{tracking.map.destination.label}</div>
                      </div>
                      <div className="stack-list">
                        <div className="buyer-kpi">
                          <span className="muted">ETA</span>
                          <strong>{tracking.eta_minutes} min</strong>
                        </div>
                        <div className="buyer-kpi">
                          <span className="muted">Distance</span>
                          <strong>{tracking.distance_km} km</strong>
                        </div>
                        <div className="buyer-kpi">
                          <span className="muted">Rider</span>
                          <strong>{tracking.logistics_partner?.name || "Delivery partner"}</strong>
                        </div>
                        <div className="stack-list">
                          {tracking.checkpoints.map((checkpoint) => (
                            <div key={checkpoint.id} className={`tracking-checkpoint${checkpoint.done ? " tracking-checkpoint--done" : ""}`}>
                              <strong>{checkpoint.label}</strong>
                              <span>{checkpoint.location || "Pending"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">{trackingError || "Tracking becomes available once a logistics partner is assigned."}</p>
                  )}
                </div>
              ) : null}

              {sellerMode ? renderSellerActions(selectedOrder) : null}

              {canAdmin(user?.role) ? (
                <div className="hero-actions">
                  {normalizedStatus(selectedOrder.status) === "Pending" ? <button className="secondary-button" onClick={() => updateStatus(selectedOrder.id, "Confirmed")} type="button">Confirm</button> : null}
                  {normalizedStatus(selectedOrder.status) === "Confirmed" ? <button className="secondary-button" onClick={() => updateStatus(selectedOrder.id, "Packed")} type="button">Packed</button> : null}
                  {normalizedStatus(selectedOrder.status) === "Packed" ? <button className="secondary-button" onClick={() => updateStatus(selectedOrder.id, "Ready For Shipping")} type="button">Ready</button> : null}
                  {normalizedStatus(selectedOrder.status) === "Ready For Shipping" ? <button className="secondary-button" onClick={() => updateStatus(selectedOrder.id, "Shipped")} type="button">Ship</button> : null}
                  {["Pending", "Confirmed", "Packed", "Ready For Shipping"].includes(normalizedStatus(selectedOrder.status)) ? <button className="secondary-button" onClick={() => updateStatus(selectedOrder.id, "Cancelled")} type="button">Cancel</button> : null}
                </div>
              ) : null}

              {user?.role === "user" ? (
                <div className="hero-actions">
                  {normalizedStatus(selectedOrder.status) === "Confirmed" ? (
                    <button 
                      className="primary-button" 
                      onClick={() => navigate(`/app/payments?order_id=${selectedOrder.id}&amount=${selectedOrder.total || (Number(selectedOrder.unit_price || 0) * Number(selectedOrder.quantity || 0))}`)} 
                      type="button"
                      style={{ background: 'var(--brand-blue)', height: '44px' }}
                    >
                      💳 Pay Now
                    </button>
                  ) : null}
                  {["Pending", "Confirmed"].includes(normalizedStatus(selectedOrder.status)) ? <button className="secondary-button" onClick={() => cancelOrder(selectedOrder.id)} type="button">Cancel order</button> : null}
                  {normalizedStatus(selectedOrder.status) === "Shipped" ? <button className="secondary-button" onClick={() => receiveOrder(selectedOrder.id)} type="button">Mark received</button> : null}
                  {normalizedStatus(selectedOrder.status) === "Received" && !selectedOrder.rating ? (
                    <>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <button key={value} className="secondary-button" onClick={() => rateOrder(selectedOrder.id, value)} type="button">
                          Rate {value}
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
