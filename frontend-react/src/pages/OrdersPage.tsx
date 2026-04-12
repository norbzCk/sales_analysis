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

  const sellerMode = canSellerManage(user?.role);

  useEffect(() => {
    void load();
  }, [sellerMode]);

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
        const logisticsData = await apiRequest<{ items: LogisticsOption[] }>("/logistics/available", { auth: false });
        setLogistics(logisticsData.items || []);
      } catch {
        setLogistics([]);
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
    const payload = {
      product_id: Number(form.get("product_id")),
      quantity: Number(form.get("quantity") || 0),
      order_date: String(form.get("order_date") || ""),
      delivery_address: String(form.get("delivery_address") || "").trim(),
      delivery_phone: String(form.get("delivery_phone") || "").trim(),
      delivery_method: String(form.get("delivery_method") || "Standard"),
      delivery_notes: String(form.get("delivery_notes") || "").trim(),
    };
    try {
      await apiRequest("/orders/", { method: "POST", body: payload });
      event.currentTarget.reset();
      setFlash("Order created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    }
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
    try {
      await apiRequest(`/business/orders/${order.id}/assign-delivery`, {
        method: "POST",
        body: {
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
              Logistics partner
              <select
                value={assignLogisticsByOrder[order.id] || ""}
                onChange={(event) =>
                  setAssignLogisticsByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
              >
                <option value="">Auto assign</option>
                {logistics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.vehicle_type ? `(${item.vehicle_type})` : ""}
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
        <form className="panel form-grid" onSubmit={handleCreate}>
          <h2>Create order</h2>
          <label>
            Product
            <select name="product_id" defaultValue={params.get("product") || ""} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {formatMoney(product.price)}
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
          <button className="primary-button" type="submit">Place order</button>
        </form>
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
