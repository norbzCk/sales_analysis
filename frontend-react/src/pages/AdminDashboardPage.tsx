import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { DashboardStats } from "../types/domain";

const initialStats: DashboardStats = {
  total_revenue: 0,
  total_orders: 0,
  total_units: 0,
  top_product: "-",
};

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(initialStats);
  const [revenueByProduct, setRevenueByProduct] = useState<Array<[string, number]>>([]);
  const [revenueOverTime, setRevenueOverTime] = useState<Array<[string, number]>>([]);
  const [recentSales, setRecentSales] = useState<Array<{ id?: number; date?: string; product?: string; category?: string; quantity?: number; revenue?: number }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [statsData, byProduct, byTime, recent] = await Promise.all([
          apiRequest<DashboardStats>("/dashboard/stats"),
          apiRequest<Record<string, number>>("/dashboard/revenue-product"),
          apiRequest<Record<string, number>>("/dashboard/revenue-time"),
          apiRequest<Array<{ id?: number; date?: string; product?: string; category?: string; quantity?: number; revenue?: number }>>("/dashboard/recent-sales"),
        ]);
        if (mounted) {
          setStats(statsData);
          setRevenueByProduct(Object.entries(byProduct));
          setRevenueOverTime(Object.entries(byTime));
          setRecentSales(recent);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (user?.role === "user") {
    return (
      <section className="panel">
        <p className="eyebrow">Dashboard</p>
        <h1>Customer accounts use the customer dashboard.</h1>
      </section>
    );
  }

  if (user?.role === "logistics") {
    return (
      <section className="panel">
        <p className="eyebrow">Dashboard</p>
        <h1>Logistics accounts use the logistics dashboard.</h1>
      </section>
    );
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Admin dashboard</p>
        <h1>Typed data, same backend metrics.</h1>
        <p className="muted">
          This first dashboard slice proves the new architecture: route-driven UI, shared auth, and typed API requests.
        </p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-label">Revenue</span>
          <strong>{loading ? "..." : `TZS ${Number(stats.total_revenue || 0).toLocaleString()}`}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Orders</span>
          <strong>{loading ? "..." : stats.total_orders}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Units</span>
          <strong>{loading ? "..." : stats.total_units}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Top product</span>
          <strong>{loading ? "..." : stats.top_product}</strong>
        </article>
      </div>

      <div className="two-column-grid">
        <article className="panel">
          <div className="panel-header"><h2>Revenue by product</h2><span>{revenueByProduct.length} items</span></div>
          <div className="stack-list">
            {revenueByProduct.length ? revenueByProduct.map(([label, value]) => (
              <div key={label} className="list-card">
                <strong>{label}</strong>
                <span>{`TZS ${Number(value || 0).toLocaleString()}`}</span>
              </div>
            )) : <p className="muted">No product revenue data yet.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header"><h2>Revenue over time</h2><span>{revenueOverTime.length} points</span></div>
          <div className="stack-list">
            {revenueOverTime.length ? revenueOverTime.map(([label, value]) => (
              <div key={label} className="list-card">
                <strong>{label}</strong>
                <span>{`TZS ${Number(value || 0).toLocaleString()}`}</span>
              </div>
            )) : <p className="muted">No time-series revenue data yet.</p>}
          </div>
        </article>
      </div>

      <div className="panel table-scroll">
        <div className="panel-header"><h2>Recent sales</h2><span>{recentSales.length}</span></div>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Quantity</th><th>Revenue</th></tr></thead>
          <tbody>
            {!recentSales.length ? <tr><td colSpan={5}>No recent sales yet.</td></tr> : null}
            {recentSales.map((sale, index) => (
              <tr key={`${sale.date || "sale"}-${index}`}>
                <td>{sale.date || "-"}</td>
                <td>{sale.product || "-"}</td>
                <td>{sale.category || "-"}</td>
                <td>{sale.quantity || 0}</td>
                <td>{`TZS ${Number(sale.revenue || 0).toLocaleString()}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
