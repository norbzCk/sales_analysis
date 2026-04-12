import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery } from "../types/domain";

export function LogisticsDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (user?.role === "logistics") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      const [profileData, deliveriesData] = await Promise.all([
        apiRequest<Record<string, unknown>>("/logistics/me"),
        apiRequest<{ deliveries: LogisticsDelivery[] }>("/logistics/deliveries"),
      ]);
      setProfile(profileData);
      setDeliveries(deliveriesData.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logistics dashboard");
    }
  }

  async function updateAvailability(type: "status" | "availability", value: string) {
    try {
      await apiRequest(`/logistics/${type}`, { method: "PUT", body: { [type]: value } });
      setFlash(`${type} updated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update logistics profile");
    }
  }

  async function updateDelivery(id: number, status: string) {
    const verification = status === "delivered" ? window.prompt("Enter verification code") || "" : "";
    try {
      await apiRequest(`/logistics/deliveries/${id}/status`, {
        method: "PUT",
        body: { status, verification_code: verification || undefined },
      });
      setFlash(`Delivery moved to ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delivery");
    }
  }

  if (user?.role !== "logistics") {
    return <section className="panel"><h1>Logistics dashboard</h1><p className="muted">This route is only for logistics accounts.</p></section>;
  }

  const metrics = (profile?.metrics as Record<string, number> | undefined) || {};

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Logistics dashboard</p>
        <h1>Delivery partner workspace</h1>
        <p className="muted">The React version now covers profile status, availability toggles, and delivery status progression.</p>
      </div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Status</span><strong>{String(profile?.status || "-")}</strong></article>
        <article className="stat-card"><span className="stat-label">Availability</span><strong>{String(profile?.availability || "-")}</strong></article>
        <article className="stat-card"><span className="stat-label">Deliveries</span><strong>{metrics.total_deliveries || 0}</strong></article>
        <article className="stat-card"><span className="stat-label">Success rate</span><strong>{metrics.success_rate || 0}</strong></article>
      </div>
      <div className="hero-actions">
        <button className="secondary-button" onClick={() => updateAvailability("status", "online")} type="button">Go online</button>
        <button className="secondary-button" onClick={() => updateAvailability("status", "offline")} type="button">Go offline</button>
        <button className="secondary-button" onClick={() => updateAvailability("availability", "available")} type="button">Available</button>
        <button className="secondary-button" onClick={() => updateAvailability("availability", "busy")} type="button">Busy</button>
      </div>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>Order</th><th>Pickup</th><th>Delivery</th><th>Status</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            {!deliveries.length ? <tr><td colSpan={6}>No deliveries assigned.</td></tr> : null}
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>#{delivery.order_id || "-"}</td>
                <td>{delivery.pickup_location}</td>
                <td>{delivery.delivery_location}</td>
                <td>{delivery.status}</td>
                <td>{delivery.price || "-"}</td>
                <td className="cell-actions">
                  {delivery.status === "assigned" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "picked_up")} type="button">Picked up</button> : null}
                  {delivery.status === "picked_up" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "in_transit")} type="button">In transit</button> : null}
                  {delivery.status === "in_transit" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "delivered")} type="button">Delivered</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
