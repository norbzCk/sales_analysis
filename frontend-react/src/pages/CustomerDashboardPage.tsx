import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { Order } from "../types/domain";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function statusFromOrder(value?: string | null) {
  const status = String(value || "").trim();
  if (status === "Delivered") return "Received";
  if (["Pending", "Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received", "Cancelled"].includes(status)) return status;
  return "Pending";
}

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "user") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      const data = await apiRequest<Order[]>("/orders/");
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer dashboard");
    }
  }

  const summary = useMemo(() => {
    const pending = orders.filter((order) => {
      const status = statusFromOrder(order.status);
      return status !== "Received" && status !== "Cancelled";
    }).length;
    const delivered = orders.filter((order) => statusFromOrder(order.status) === "Received").length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      total: orders.length,
      pending,
      delivered,
      totalSpent,
    };
  }, [orders]);

  if (user?.role !== "user") {
    return <section className="panel"><h1>Customer dashboard</h1><p className="muted">This dashboard is only for customer accounts.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Customer dashboard</p>
        <h1>Track orders and recent activity</h1>
        <p className="muted">This ports the legacy customer dashboard summary cards, notifications, and recent orders table into React.</p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Recent orders</span><strong>{summary.total}</strong></article>
        <article className="stat-card"><span className="stat-label">Pending orders</span><strong>{summary.pending}</strong></article>
        <article className="stat-card"><span className="stat-label">Received orders</span><strong>{summary.delivered}</strong></article>
        <article className="stat-card"><span className="stat-label">Total spent</span><strong>{formatMoney(summary.totalSpent)}</strong></article>
      </div>

      <div className="two-column-grid">
        <article className="panel">
          <div className="panel-header"><h2>Notifications</h2><span>{Math.min(orders.length, 3)}</span></div>
          <div className="stack-list">
            {!orders.length ? <p className="muted">No notifications yet.</p> : null}
            {orders.slice(0, 3).map((order) => (
              <div key={order.id} className="list-card">
                <span>Order #{order.id} is currently <strong>{statusFromOrder(order.status)}</strong>.</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel table-scroll">
          <div className="panel-header"><h2>Recent orders</h2><span>{Math.min(orders.length, 6)}</span></div>
          <table className="data-table">
            <thead><tr><th>Order ID</th><th>Date</th><th>Product</th><th>Provider</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {!orders.length ? <tr><td colSpan={7}>No orders yet.</td></tr> : null}
              {orders.slice(0, 6).map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.order_date || "-"}</td>
                  <td>{order.product || "-"}</td>
                  <td>{order.provider_name || "-"}</td>
                  <td>{order.quantity || 0}</td>
                  <td>{formatMoney(order.total)}</td>
                  <td>{statusFromOrder(order.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
}
