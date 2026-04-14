import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery } from "../types/domain";

interface LogisticsOption {
  id: number;
  name: string;
  vehicle_type?: string | null;
  base_area?: string | null;
}

interface CommunicationItem {
  thread_id: string;
  order_id?: number | null;
  customer_id?: number | null;
  subject?: string | null;
  latest_message?: string | null;
  delivery_address?: string | null;
}

interface NotificationItem {
  type: string;
  title: string;
  message: string;
  created_at?: string | null;
}

function money(value?: number | null) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function deliveryStatusLabel(value?: string | null) {
  if (!value) return "Pending";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function deliveryStatusClass(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "delivered") return "ok";
  if (["assigned", "picked_up", "in_transit"].includes(normalized)) return "warn";
  if (normalized === "cancelled") return "danger";
  return "warn";
}

export function SellerDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [communication, setCommunication] = useState<CommunicationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [logistics, setLogistics] = useState<LogisticsOption[]>([]);
  const [instructions, setInstructions] = useState<Record<number, string>>({});
  const [destinations, setDestinations] = useState<Record<number, string>>({});
  const [selectedLogistics, setSelectedLogistics] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    setFlash("");
    try {
      const [deliveryData, communicationData, notificationData] = await Promise.all([
        apiRequest<{ items: LogisticsDelivery[] }>("/business/deliveries"),
        apiRequest<{ items: CommunicationItem[] }>("/business/communication/feed"),
        apiRequest<{ items: NotificationItem[] }>("/business/notifications"),
      ]);
      setDeliveries(deliveryData.items || []);
      setCommunication(communicationData.items || []);
      setNotifications(notificationData.items || []);

      const nextInstructions: Record<number, string> = {};
      const nextDestinations: Record<number, string> = {};
      for (const item of deliveryData.items || []) {
        nextInstructions[item.id] = String(item.special_instructions || "");
        nextDestinations[item.id] = String(item.delivery_location || "");
      }
      setInstructions(nextInstructions);
      setDestinations(nextDestinations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seller deliveries");
    } finally {
      setLoading(false);
    }

    try {
      const logisticsData = await apiRequest<{ items: LogisticsOption[] }>("/logistics/available", { auth: false });
      setLogistics(logisticsData.items || []);
    } catch {
      setLogistics([]);
    }
  }

  const visibleDeliveries = useMemo(() => {
    if (statusFilter === "all") return deliveries;
    return deliveries.filter((item) => item.status === statusFilter);
  }, [deliveries, statusFilter]);

  const summary = useMemo(() => {
    const ongoing = deliveries.filter((item) => ["assigned", "picked_up", "in_transit"].includes(String(item.status || ""))).length;
    const completed = deliveries.filter((item) => item.status === "delivered").length;
    const cancelled = deliveries.filter((item) => item.status === "cancelled").length;
    return {
      total: deliveries.length,
      ongoing,
      completed,
      cancelled,
    };
  }, [deliveries]);

  async function saveInstructions(deliveryId: number) {
    setError("");
    setFlash("");
    try {
      await apiRequest(`/business/deliveries/${deliveryId}/instructions`, {
        method: "PATCH",
        body: {
          special_instructions: instructions[deliveryId] || null,
          delivery_location: destinations[deliveryId] || null,
        },
      });
      setFlash(`Delivery #${deliveryId} instructions updated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delivery instructions");
    }
  }

  async function reassignDelivery(delivery: LogisticsDelivery) {
    const logisticsId = Number(selectedLogistics[delivery.id] || 0);
    if (!delivery.order_id || !logisticsId) {
      setError("Select a logistics partner before reassigning.");
      return;
    }
    setError("");
    setFlash("");
    try {
      await apiRequest(`/business/orders/${delivery.order_id}/assign-delivery`, {
        method: "POST",
        body: {
          logistics_id: logisticsId,
          delivery_location: destinations[delivery.id] || delivery.delivery_location,
          special_instructions: instructions[delivery.id] || delivery.special_instructions || null,
        },
      });
      setFlash(`Delivery for order #${delivery.order_id} reassigned successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign delivery");
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Seller deliveries</p>
        <h1>Delivery coordination and customer communication</h1>
        <p className="muted">
          Track assigned deliveries, update destination instructions, and keep customer order conversations visible from one page.
        </p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Total deliveries</span><strong>{summary.total}</strong></article>
        <article className="stat-card"><span className="stat-label">Ongoing</span><strong>{summary.ongoing}</strong></article>
        <article className="stat-card"><span className="stat-label">Delivered</span><strong>{summary.completed}</strong></article>
        <article className="stat-card"><span className="stat-label">Cancelled</span><strong>{summary.cancelled}</strong></article>
      </div>

      <div className="panel filter-grid">
        <label>
          Delivery status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked up</option>
            <option value="in_transit">In transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <div className="delivery-card-grid">
        {loading ? (
          <article className="panel">
            <p className="muted">Loading deliveries...</p>
          </article>
        ) : null}
        {!loading && !visibleDeliveries.length ? (
          <article className="panel">
            <p className="muted">No deliveries found.</p>
          </article>
        ) : null}
        {visibleDeliveries.map((delivery) => (
          <article key={delivery.id} className="delivery-card panel">
            <div className="delivery-card-header">
              <div>
                <strong>Order #{delivery.order_id || "-"}</strong>
                <p className="muted">{delivery.delivery_address || delivery.pickup_location || "Delivery route"}</p>
              </div>
              <span className={`status-pill ${deliveryStatusClass(delivery.status)}`}>
                {deliveryStatusLabel(delivery.status)}
              </span>
            </div>

            <div className="delivery-card-row">
              <div>
                <p className="muted">Pickup</p>
                <strong>{delivery.pickup_location || "Not specified"}</strong>
              </div>
              <div>
                <p className="muted">Destination</p>
                <strong>{destinations[delivery.id] || delivery.delivery_location || "Not specified"}</strong>
              </div>
              <div>
                <p className="muted">Price</p>
                <strong>{money(delivery.price)}</strong>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Logistics partner
                <select
                  value={selectedLogistics[delivery.id] || ""}
                  onChange={(event) =>
                    setSelectedLogistics((prev) => ({ ...prev, [delivery.id]: event.target.value }))
                  }
                >
                  <option value="">Choose logistics</option>
                  {logistics.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} {agent.vehicle_type ? `(${agent.vehicle_type})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Delivery destination
                <input
                  value={destinations[delivery.id] || ""}
                  onChange={(event) =>
                    setDestinations((prev) => ({ ...prev, [delivery.id]: event.target.value }))
                  }
                  placeholder="Delivery destination"
                />
              </label>

              <label className="full-width">
                Special instructions
                <textarea
                  rows={3}
                  value={instructions[delivery.id] || ""}
                  onChange={(event) =>
                    setInstructions((prev) => ({ ...prev, [delivery.id]: event.target.value }))
                  }
                  placeholder="Special handling notes"
                />
              </label>
            </div>

            <div className="delivery-card-actions">
              <button className="secondary-button" type="button" onClick={() => saveInstructions(delivery.id)}>
                Save updates
              </button>
              <button className="secondary-button" type="button" onClick={() => reassignDelivery(delivery)}>
                Reassign delivery
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="two-column-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Communication feed</h2>
            <span>{communication.length}</span>
          </div>
          <div className="stack-list">
            {!communication.length ? <p className="muted">No order conversations yet.</p> : null}
            {communication.map((thread) => (
              <div key={thread.thread_id} className="list-card">
                <div>
                  <strong>{thread.subject || `Order #${thread.order_id || "-"}`}</strong>
                  <p className="muted">{thread.latest_message || "No message yet."}</p>
                </div>
                <span>{thread.delivery_address || "-"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Business notifications</h2>
            <span>{notifications.length}</span>
          </div>
          <div className="stack-list">
            {!notifications.length ? <p className="muted">No notifications yet.</p> : null}
            {notifications.map((item, index) => (
              <div key={`${item.type}-${index}`} className="list-card">
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.message}</p>
                </div>
                <span>{item.type}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
