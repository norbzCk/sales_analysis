import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery, Order, Product } from "../types/domain";

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

export function OrdersPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
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

  const deliveryByOrderId = useMemo(() => {
    const map = new Map<number, LogisticsDelivery>();
    for (const item of deliveries) {
      if (item.order_id) {
        map.set(Number(item.order_id), item);
      }
    }
    return map;
  }, [deliveries]);

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

    setDraftOrders((prev) => [...prev, payload]);
    setFlash("Order added to temporary list. Confirm when ready.");
    event.currentTarget.reset();
  }

  function removeDraftItem(id: string) {
    setDraftOrders((prev) => prev.filter((item) => item.id !== id));
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

        <div className="panel" style={{ padding: "16px" }}>
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

      {user?.role === "user" ? (
        <div className="two-column-grid">
          <form className="panel form-grid" onSubmit={handleCreate}>
            <h2>Add order to temporary list</h2>
            <label>
              Product
              <select name="product_id" defaultValue={params.get("product") || ""} required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {formatMoney(product.price)} ({product.seller_name || product.seller?.business_name || "seller"})
                  </option>
                ))}
              </select>
            </label>
            <label>Quantity<input name="quantity" type="number" min="1" required /></label>
            <label>Order date<input name="order_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label>Delivery address<input name="delivery_address" defaultValue={user?.address || ""} /></label>
            <label>Delivery phone<input name="delivery_phone" defaultValue={user?.phone || ""} /></label>
            <label>
              Delivery method
              <select name="delivery_method" defaultValue="Standard">
                <option value="Standard">Standard</option>
                <option value="Express">Express</option>
                <option value="Pickup">Pickup</option>
              </select>
            </label>
            <label>Notes<input name="delivery_notes" /></label>
            <button className="primary-button" type="submit">Save temporarily</button>
          </form>

          <article className="panel stack-list">
            <div className="panel-header">
              <h2>Temporary order list</h2>
              <span>{draftOrders.length} item(s)</span>
            </div>
            {!draftOrders.length ? <p className="muted">No temporary orders yet.</p> : null}
            {draftOrders.map((item) => (
              <div key={item.id} className="list-card">
                <div>
                  <strong>{item.product_name}</strong>
                  <p className="muted">{item.seller_name}</p>
                  <p className="muted">Qty {item.quantity} · {item.delivery_method}</p>
                </div>
                <div className="stack-list">
                  <strong>{formatMoney(item.unit_price * item.quantity)}</strong>
                  <button className="secondary-button" type="button" onClick={() => removeDraftItem(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="buyer-kpi">
              <span className="muted">Units: {draftSummary.units}</span>
              <strong>Total: {formatMoney(draftSummary.total)}</strong>
            </div>
            <button className="primary-button" type="button" onClick={() => void confirmDraftOrders()} disabled={!draftOrders.length}>
              Confirm order(s)
            </button>
          </article>
        </div>
      ) : null}

      <div className="panel filter-grid">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders" /></label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="two-column-grid">
        <div className="panel stack-list">
          {loading ? <p>Loading orders...</p> : null}
          {!loading && !visibleOrders.length ? <p>No orders found.</p> : null}
          {visibleOrders.map((order) => (
            <button
              key={order.id}
              className={`order-list-item${selectedOrder?.id === order.id ? " active" : ""}`}
              onClick={() => setSelectedId(order.id)}
              type="button"
            >
              <strong>#{order.id} {order.product || "-"}</strong>
              <span>{normalizedStatus(order.status)} · {formatMoney(order.total || (Number(order.unit_price || 0) * Number(order.quantity || 0)))}</span>
            </button>
          ))}
        </div>

        <div className="panel">
          {!selectedOrder ? <p className="muted">Select an order to inspect it.</p> : (
            <div className="stack-list">
              <div>
                <p className="eyebrow">Order details</p>
                <h2>#{selectedOrder.id} {selectedOrder.product || "-"}</h2>
                <p className="muted">{selectedOrder.category || "General"} · {selectedOrder.provider_name || "Provider unavailable"}</p>
              </div>
              <div className="two-up">
                <span>Quantity: {selectedOrder.quantity || 0}</span>
                <span>Total: {formatMoney(selectedOrder.total || (Number(selectedOrder.unit_price || 0) * Number(selectedOrder.quantity || 0)))}</span>
              </div>
              <div className="two-up">
                <span>Delivery: {selectedOrder.delivery_method || "Standard"}</span>
                <span>Status: {normalizedStatus(selectedOrder.status)}</span>
              </div>
              <p className="muted">Address: {selectedOrder.delivery_address || "No address"}</p>
              <p className="muted">Phone: {selectedOrder.delivery_phone || "-"}</p>
              <p className="muted">Customer: {selectedOrder.created_by || "-"}</p>
              {selectedOrder.status_reason ? <p className="muted">Reason: {selectedOrder.status_reason}</p> : null}

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
