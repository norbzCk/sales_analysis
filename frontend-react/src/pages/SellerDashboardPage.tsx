import { useEffect, useMemo, useRef, useState } from "react";
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

type MetricVariant = "money" | "count";

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

function formatMetric(value: number, variant: MetricVariant) {
  if (variant === "money") return money(Math.round(value));
  return Math.round(value).toLocaleString();
}

function formatAxisDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

function AnimatedMetricValue({ value, variant }: { value: number; variant: MetricVariant }) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = Number(value || 0);

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return undefined;
    }

    let frame = 0;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime == null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      } else {
        previousValueRef.current = endValue;
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <strong>{formatMetric(displayValue, variant)}</strong>;
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

  const productRevenue = useMemo(() => {
    const rows = overview?.top_products.slice(0, 6) || [];
    const maxRevenue = Math.max(...rows.map((entry) => Number(entry.revenue || 0)), 1);
    return rows.map((entry) => ({
      ...entry,
      ratio: Math.max(8, Math.round((Number(entry.revenue || 0) / maxRevenue) * 100)),
    }));
  }, [overview]);

  const demandChart = useMemo(() => {
    const maxUnits = Math.max(...demand.map((entry) => Number(entry.units || 0)), 1);
    return demand.slice(0, 7).map((entry) => ({
      ...entry,
      ratio: Math.max(8, Math.round((Number(entry.units || 0) / maxUnits) * 100)),
    }));
  }, [demand]);

  const orderMix = useMemo(() => {
    if (!overview) return null;
    return pieSegments(overview.summary);
  }, [overview]);

  const highlightedProduct = useMemo(() => {
    if (!overview?.top_products.length) return null;
    return [...overview.top_products].sort((left, right) => Number(right.units || 0) - Number(left.units || 0))[0] || null;
  }, [overview]);

  const averageOrderValue = useMemo(() => {
    if (!overview?.summary.orders_total) return 0;
    return Number(overview.summary.revenue_total || 0) / Number(overview.summary.orders_total || 1);
  }, [overview]);

  const completionRate = useMemo(() => {
    if (!overview?.summary.orders_total) return 0;
    return Math.round((Number(overview.summary.orders_completed || 0) / Number(overview.summary.orders_total || 1)) * 100);
  }, [overview]);

  const inventoryCoverage = useMemo(() => {
    if (!overview?.inventory.total_products) return 100;
    const riskyProducts = Number(overview.inventory.low_stock || 0) + Number(overview.inventory.out_of_stock || 0);
    const healthyProducts = Math.max(Number(overview.inventory.total_products || 0) - riskyProducts, 0);
    return Math.round((healthyProducts / Number(overview.inventory.total_products || 1)) * 100);
  }, [overview]);

  const recentSales = useMemo(() => {
    return recentOrders.slice(0, 5);
  }, [recentOrders]);

  return (
    <section className="panel-stack seller-dashboard">
      <div className="panel seller-hero soft-lift" key={`hero-${refreshTick}`}>
        <div className="seller-hero__copy">
          <p className="eyebrow">Business workspace</p>
          <h1>Business Overview</h1>
          <p className="muted">Live totals and trends from your recorded sales.</p>
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
          <div className="seller-metric-grid dashboard-soft" key={`stats-${refreshTick}`}>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Revenue today</span>
              <AnimatedMetricValue value={Number(overview.summary.revenue_today || 0)} variant="money" />
              <p className="muted">Cash captured so far today.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Revenue month</span>
              <AnimatedMetricValue value={Number(overview.summary.revenue_month || 0)} variant="money" />
              <p className="muted">Current month performance.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Total revenue</span>
              <AnimatedMetricValue value={Number(overview.summary.revenue_total || 0)} variant="money" />
              <p className="muted">Lifetime recorded business sales.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Orders total</span>
              <AnimatedMetricValue value={Number(overview.summary.orders_total || 0)} variant="count" />
              <p className="muted">All tracked order activity.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Avg order value</span>
              <AnimatedMetricValue value={averageOrderValue} variant="money" />
              <p className="muted">Average basket size across orders.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Completion rate</span>
              <AnimatedMetricValue value={completionRate} variant="count" />
              <p className="muted">Percent of orders completed successfully.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Ongoing deliveries</span>
              <AnimatedMetricValue value={Number(overview.summary.ongoing_deliveries || 0)} variant="count" />
              <p className="muted">Orders still in fulfillment.</p>
            </article>
            <article className="stat-card metric-premium seller-metric-card">
              <span className="stat-label">Inventory health</span>
              <AnimatedMetricValue value={inventoryCoverage} variant="count" />
              <p className="muted">Products currently outside low-stock risk.</p>
            </article>
          </div>

          <div className="seller-analytics-grid dashboard-soft" key={`analytics-${refreshTick}`}>
            <article className="panel chart-panel seller-panel-wide">
              <div className="panel-header">
                <div>
                  <h2>Revenue over time</h2>
                  <p className="muted">
                    {lineChart.points.length ? `Range: ${compactMoney(lineChart.min)} to ${compactMoney(lineChart.max)}` : "No revenue trend yet"}
                  </p>
                </div>
                <span>{rangeDays} days</span>
              </div>
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
              <div className="seller-axis-row">
                {(revenueTimeline.length ? revenueTimeline : [{ date: "", revenue: 0 }]).slice(0, 6).map((entry, index) => (
                  <span key={`${entry.date}-${index}`}>{formatAxisDate(entry.date)}</span>
                ))}
              </div>
            </article>

            <article className="panel chart-panel seller-demand-panel">
              <div className="panel-header">
                <div>
                  <h2>Revenue by product</h2>
                  <p className="muted">Which items are contributing the most cash.</p>
                </div>
                <span>{productRevenue.length}</span>
              </div>
              <div className="bar-chart-grid">
                {!productRevenue.length ? <p className="muted">No product revenue data yet.</p> : null}
                {productRevenue.map((entry) => (
                  <div key={entry.product} className="bar-row seller-bar-row">
                    <span>{entry.product}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${entry.ratio}%` }} />
                    </div>
                    <strong>{compactMoney(entry.revenue)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel chart-panel">
              <div className="panel-header">
                <div>
                  <h2>Order status mix</h2>
                  <p className="muted">Keep an eye on flow and fulfillment balance.</p>
                </div>
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

          <div className="seller-insight-grid dashboard-soft" key={`insights-${refreshTick}`}>
            <article className="panel seller-spotlight-card">
              <p className="eyebrow">Most sold product</p>
              <h2>{highlightedProduct?.product || "No product data yet"}</h2>
              <p className="muted">
                {highlightedProduct
                  ? "Your strongest seller based on total units moved."
                  : "Start recording sales to surface your top-moving item."}
              </p>
              <div className="seller-spotlight-stats">
                <div className="seller-mini-kpi">
                  <span className="muted">Units sold</span>
                  <AnimatedMetricValue value={Number(highlightedProduct?.units || 0)} variant="count" />
                </div>
                <div className="seller-mini-kpi">
                  <span className="muted">Revenue</span>
                  <AnimatedMetricValue value={Number(highlightedProduct?.revenue || 0)} variant="money" />
                </div>
              </div>
            </article>

            <article className="panel chart-panel">
              <div className="panel-header">
                <div>
                  <h2>Demand by category</h2>
                  <p className="muted">See which product groups are moving fastest.</p>
                </div>
                <span>{demand.length}</span>
              </div>
              <div className="bar-chart-grid">
                {!demandChart.length ? <p className="muted">No category demand data yet.</p> : null}
                {demandChart.map((entry) => (
                  <div key={entry.category} className="bar-row seller-bar-row">
                    <span>{entry.category}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${entry.ratio}%` }} />
                    </div>
                    <strong>{entry.units}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel seller-list-panel seller-recent-panel">
              <div className="panel-header">
                <div>
                  <h2>Recent sales</h2>
                  <p className="muted">Latest revenue activity from recorded orders.</p>
                </div>
                <span>{recentSales.length}</span>
              </div>
              <div className="stack-list">
                {!recentSales.length ? <p className="muted">No recent sales yet.</p> : null}
                {recentSales.map((order) => (
                  <div key={order.id} className="list-card seller-recent-sale">
                    <div>
                      <strong>{order.product || "Untitled product"}</strong>
                      <p className="muted">{formatAxisDate(order.order_date)} · {order.category || "General"}</p>
                    </div>
                    <div className="seller-recent-sale__meta">
                      <span>Qty {order.quantity || 0}</span>
                      <strong>{money(order.total || Number(order.quantity || 0) * Number(order.unit_price || 0))}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel seller-list-panel seller-inventory-panel">
              <div className="panel-header">
                <div>
                  <h2>Inventory alerts</h2>
                  <p className="muted">Products that need attention before stockouts hit.</p>
                </div>
                <span>{overview.inventory.alerts.length}</span>
              </div>
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

            <article className="panel seller-list-panel seller-notification-panel">
              <div className="panel-header">
                <div>
                  <h2>Notifications</h2>
                  <p className="muted">Latest operational alerts from your business workspace.</p>
                </div>
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

          <div className="panel table-scroll dashboard-soft" key={`table-${refreshTick}`}>
            <div className="panel-header">
              <div>
                <h2>Sales activity ledger</h2>
                <p className="muted">Recent order performance with revenue and status.</p>
              </div>
              <span>{recentOrders.length} rows</span>
            </div>
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
                    <td>{formatDateTime(order.order_date)}</td>
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
