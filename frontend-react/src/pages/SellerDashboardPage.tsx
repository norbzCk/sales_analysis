import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/http";
import type { Order, SellerDashboardOverview } from "../types/domain";

interface NotificationItem {
  type: string;
  title: string;
  message: string;
  created_at?: string | null;
}

interface DemandRow {
  category: string;
  units: number;
}

interface RevenueRow {
  date: string;
  revenue: number;
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 300;
const CHART_PADDING = 36;

function money(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

function orderStatusLabel(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Pending";
  if (normalized === "delivered") return "Received";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLineChartGeometry(values: number[]) {
  const safe = values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  const points = safe.map((value, index) => {
    const x = CHART_PADDING + (safe.length <= 1 ? innerWidth / 2 : (index / (safe.length - 1)) * innerWidth);
    const y = CHART_PADDING + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y, value };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT - CHART_PADDING} L ${points[0].x} ${CHART_HEIGHT - CHART_PADDING} Z`
    : "";

  return { points, linePath, areaPath, min, max };
}

function pieSegments(summary: SellerDashboardOverview["summary"]) {
  const segments = [
    { label: "Pending", value: summary.orders_pending, color: "var(--brand-orange)" },
    { label: "Completed", value: summary.orders_completed, color: "var(--brand-blue)" },
    { label: "Cancelled", value: summary.orders_cancelled, color: "#ef4444" },
  ];
  const total = segments.reduce((sum, entry) => sum + Number(entry.value || 0), 0) || 1;

  let cursor = 0;
  const gradientParts = segments.map((entry) => {
    const start = cursor;
    const sweep = (Number(entry.value || 0) / total) * 360;
    const end = cursor + sweep;
    cursor = end;
    return `${entry.color} ${start}deg ${end}deg`;
  });

  return {
    total,
    segments,
    conic: `conic-gradient(${gradientParts.join(", ")})`,
  };
}

export function SellerDashboardPage() {
  const [overview, setOverview] = useState<SellerDashboardOverview | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [revenueTimeline, setRevenueTimeline] = useState<RevenueRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    void load(true);
  }, [rangeDays]);

  async function load(initialLoad = false) {
    if (initialLoad) setLoading(true);
    if (!initialLoad) setRefreshing(true);
    setError("");

    try {
      const [overviewData, notificationsData, analyticsData, orderData] = await Promise.all([
        apiRequest<SellerDashboardOverview>("/business/dashboard/overview"),
        apiRequest<{ items: NotificationItem[] }>("/business/notifications"),
        apiRequest<{ demand_by_category: DemandRow[]; revenue_timeline: RevenueRow[] }>(`/business/analytics?range_days=${rangeDays}`),
        apiRequest<{ items: Order[] }>("/business/orders"),
      ]);
      setOverview(overviewData);
      setNotifications(notificationsData.items || []);
      setDemand(analyticsData.demand_by_category || []);
      setRevenueTimeline(analyticsData.revenue_timeline || []);
      setRecentOrders((orderData.items || []).slice(0, 8));
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seller dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const lineChart = useMemo(
    () => buildLineChartGeometry(revenueTimeline.map((entry) => Number(entry.revenue || 0))),
    [revenueTimeline],
  );

  const demandChart = useMemo(() => {
    const maxUnits = Math.max(...demand.map((entry) => Number(entry.units || 0)), 1);
    return demand.slice(0, 7).map((entry) => ({
      ...entry,
      ratio: Math.max(6, Math.round((Number(entry.units || 0) / maxUnits) * 100)),
    }));
  }, [demand]);

  const orderMix = useMemo(() => {
    if (!overview) return null;
    return pieSegments(overview.summary);
  }, [overview]);

  return (
    <section className="panel-stack seller-dashboard">
      <div className="panel seller-hero soft-lift" key={`hero-${refreshTick}`}>
        <div>
          <p className="eyebrow">Seller dashboard</p>
          <h1>Business performance and operations</h1>
          <p className="muted">
            Monitor revenue, order flow, stock pressure, and delivery coordination from one live workspace.
          </p>
        </div>
        <div className="hero-actions">
          <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="secondary-button" type="button" onClick={() => void load(false)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh analytics"}
          </button>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {loading ? <p className="panel">Loading dashboard...</p> : null}

      {overview ? (
        <>
          <div className="stat-grid dashboard-soft" key={`stats-${refreshTick}`}>
            <article className="stat-card metric-premium"><span className="stat-label">Revenue today</span><strong>{money(overview.summary.revenue_today)}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Revenue week</span><strong>{money(overview.summary.revenue_week)}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Revenue month</span><strong>{money(overview.summary.revenue_month)}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Total revenue</span><strong>{money(overview.summary.revenue_total)}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Pending orders</span><strong>{overview.summary.orders_pending}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Completed orders</span><strong>{overview.summary.orders_completed}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Ongoing deliveries</span><strong>{overview.summary.ongoing_deliveries}</strong></article>
            <article className="stat-card metric-premium"><span className="stat-label">Low stock alerts</span><strong>{overview.summary.inventory_low_stock}</strong></article>
          </div>

          <div className="two-column-grid dashboard-soft" key={`trend-${refreshTick}`}>
            <article className="panel chart-panel">
              <div className="panel-header">
                <h2>Revenue trend</h2>
                <span>{rangeDays} days</span>
              </div>
              <p className="muted">
                {lineChart.points.length ? `Range: ${compactMoney(lineChart.min)} to ${compactMoney(lineChart.max)}` : "No revenue trend yet"}
              </p>
              <div className="line-chart-shell">
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Revenue line chart">
                  <defs>
                    <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff7a00" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#ff7a00" stopOpacity="0.04" />
                    </linearGradient>
                  </defs>
                  <line x1={CHART_PADDING} y1={CHART_PADDING} x2={CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.16)" />
                  <line x1={CHART_PADDING} y1={CHART_HEIGHT - CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.16)" />
                  {lineChart.areaPath ? <path d={lineChart.areaPath} fill="url(#revenueAreaGradient)" /> : null}
                  {lineChart.linePath ? <path d={lineChart.linePath} fill="none" stroke="#0f67b5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
                  {lineChart.points.map((point, index) => (
                    <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={4.5} fill="#0f67b5" />
                  ))}
                </svg>
              </div>
            </article>

            <article className="panel chart-panel">
              <div className="panel-header">
                <h2>Order status mix</h2>
                <span>{overview.summary.orders_total}</span>
              </div>
              <div className="order-mix-grid">
                <div className="order-donut" style={{ background: orderMix?.conic || "conic-gradient(#d1d5db 0deg 360deg)" }} />
                <div className="stack-list">
                  {orderMix?.segments.map((segment) => (
                    <div key={segment.label} className="list-card compact-card">
                      <div className="legend-chip" style={{ background: segment.color }} />
                      <strong>{segment.label}</strong>
                      <span>{segment.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <div className="two-column-grid dashboard-soft" key={`demand-${refreshTick}`}>
            <article className="panel chart-panel">
              <div className="panel-header">
                <h2>Demand by category</h2>
                <span>{demand.length}</span>
              </div>
              <div className="bar-chart-grid">
                {!demandChart.length ? <p className="muted">No category demand data yet.</p> : null}
                {demandChart.map((entry) => (
                  <div key={entry.category} className="bar-row">
                    <span>{entry.category}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${entry.ratio}%` }} />
                    </div>
                    <strong>{entry.units}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header"><h2>Top products</h2><span>{overview.top_products.length}</span></div>
              <div className="stack-list">
                {!overview.top_products.length ? <p className="muted">No sales yet.</p> : null}
                {overview.top_products.map((row) => (
                  <div key={row.product} className="list-card">
                    <div>
                      <strong>{row.product}</strong>
                      <p className="muted">{row.units} units sold</p>
                    </div>
                    <span>{money(row.revenue)}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="two-column-grid dashboard-soft" key={`ops-${refreshTick}`}>
            <article className="panel">
              <div className="panel-header"><h2>Inventory alerts</h2><span>{overview.inventory.alerts.length}</span></div>
              <div className="stack-list">
                {!overview.inventory.alerts.length ? <p className="muted">Inventory is healthy.</p> : null}
                {overview.inventory.alerts.map((item) => (
                  <div key={item.product_id} className="list-card">
                    <div>
                      <strong>{item.product_name}</strong>
                      <p className="muted">Threshold: {item.low_stock_threshold}</p>
                    </div>
                    <span>{item.current_stock} left</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header"><h2>Notifications</h2><span>{notifications.length}</span></div>
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

          <div className="panel table-scroll dashboard-soft" key={`table-${refreshTick}`}>
            <div className="panel-header"><h2>Recent order performance</h2><span>{recentOrders.length} rows</span></div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!recentOrders.length ? <tr><td colSpan={6}>No order activity yet.</td></tr> : null}
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_date || "-"}</td>
                    <td>{order.product || "-"}</td>
                    <td>{order.category || "-"}</td>
                    <td>{order.quantity || 0}</td>
                    <td>{money(order.total || Number(order.quantity || 0) * Number(order.unit_price || 0))}</td>
                    <td>{orderStatusLabel(order.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
