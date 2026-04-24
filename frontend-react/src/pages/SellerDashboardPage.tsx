import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../config/env";
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

interface ProductRevenueRow {
  product: string;
  revenue: number;
}

interface SellerAnalyticsResponse {
  range_days: number;
  revenue_timeline: RevenueRow[];
  revenue_by_product: ProductRevenueRow[];
  demand_by_category: DemandRow[];
  graphs?: {
    revenueOverTime?: string;
    revenueByProduct?: string;
  };
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

function resolveGraphUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${env.apiBase}${path}`;
  return `${env.apiBase}/${path.replace(/^\/+/, "")}`;
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
  const [revenueByProduct, setRevenueByProduct] = useState<ProductRevenueRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [graphUrls, setGraphUrls] = useState<{ revenueOverTime?: string; revenueByProduct?: string }>({});

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
        apiRequest<SellerAnalyticsResponse>(`/business/analytics?range_days=${rangeDays}`),
        apiRequest<{ items: Order[] }>("/business/orders"),
      ]);

      setOverview(overviewData);
      setNotifications(notificationsData.items || []);
      setDemand(analyticsData.demand_by_category || []);
      setRevenueTimeline(analyticsData.revenue_timeline || []);
      setRevenueByProduct(analyticsData.revenue_by_product || []);
      setGraphUrls({
        revenueOverTime: resolveGraphUrl(analyticsData.graphs?.revenueOverTime),
        revenueByProduct: resolveGraphUrl(analyticsData.graphs?.revenueByProduct),
      });
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

  const productRevenueBars = useMemo(() => {
    const rows = revenueByProduct.slice(0, 6) || [];
    const maxRevenue = Math.max(...rows.map((entry) => Number(entry.revenue || 0)), 1);
    return rows.map((entry) => ({
      ...entry,
      ratio: Math.max(8, Math.round((Number(entry.revenue || 0) / maxRevenue) * 100)),
    }));
  }, [revenueByProduct]);

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

  const classicMetricCards = useMemo(() => {
    if (!overview) return [];
    return [
      { id: "rev-today", label: "Revenue today", value: Number(overview.summary.revenue_today || 0), variant: "money" as const, note: "Today" },
      { id: "rev-week", label: "Revenue week", value: Number(overview.summary.revenue_week || 0), variant: "money" as const, note: "7 day pace" },
      { id: "rev-month", label: "Revenue month", value: Number(overview.summary.revenue_month || 0), variant: "money" as const, note: "Month to date" },
      { id: "rev-total", label: "Total revenue", value: Number(overview.summary.revenue_total || 0), variant: "money" as const, note: "All time" },
      { id: "orders-total", label: "Orders total", value: Number(overview.summary.orders_total || 0), variant: "count" as const, note: "Recorded orders" },
      { id: "orders-pending", label: "Pending orders", value: Number(overview.summary.orders_pending || 0), variant: "count" as const, note: "Need action" },
      { id: "orders-complete", label: "Completed orders", value: Number(overview.summary.orders_completed || 0), variant: "count" as const, note: "Delivered successfully" },
      { id: "deliveries-live", label: "Ongoing deliveries", value: Number(overview.summary.ongoing_deliveries || 0), variant: "count" as const, note: "In progress" },
      { id: "avg-order", label: "Avg order value", value: averageOrderValue, variant: "money" as const, note: "Per order" },
      { id: "stock-alerts", label: "Low stock alerts", value: Number(overview.summary.inventory_low_stock || 0), variant: "count" as const, note: "Inventory watch" },
    ];
  }, [averageOrderValue, overview]);

  return (
    <section className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-gradient-to-br from-brand/5 to-accent/5 rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 md:p-8" key={`hero-${refreshTick}`}>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-brand uppercase tracking-wider">Business workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Business Overview</h1>
          <p className="mt-2 text-sm text-slate-500">Live totals and trends from your recorded sales.</p>
          {overview?.performance_badges?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {overview.performance_badges.map((badge) => (
                <span key={badge.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{badge.label}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => void load(false)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh analytics"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="rounded-lg bg-white p-6 text-center text-slate-500 shadow-sm">Loading dashboard...</p> : null}

      {overview ? (
        <>
          {/* Key Metrics Section */}
          <div className="space-y-6 rounded-2xl bg-slate-50/50 p-6" key={`metrics-${refreshTick}`}>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Key Performance Metrics</h2>
              <p className="mt-1 text-sm text-slate-500">Your business performance at a glance</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {classicMetricCards.slice(0, 5).map((card) => (
                <article key={card.id} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 transition-shadow hover:shadow-md">
                  <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    <AnimatedMetricValue value={card.value} variant={card.variant} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                </article>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {classicMetricCards.slice(5).map((card) => (
                <article key={card.id} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 transition-shadow hover:shadow-md opacity-90">
                  <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    <AnimatedMetricValue value={card.value} variant={card.variant} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                </article>
              ))}
            </div>
          </div>

          {/* Analytics Charts Section */}
          <div className="space-y-6 rounded-2xl bg-slate-50/50 p-6" key={`analytics-${refreshTick}`}>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Analytics & Insights</h2>
              <p className="mt-1 text-sm text-slate-500">Visual breakdown of your sales performance</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Revenue Trends</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {lineChart.points.length ? `Revenue progression over time` : "No revenue trend yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{rangeDays} days</span>
                    {lineChart.points.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Range:</span>
                        <span className="text-xs font-medium text-slate-900">{compactMoney(lineChart.min)} - {compactMoney(lineChart.max)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6">
                  {graphUrls.revenueOverTime ? (
                    <div className="overflow-hidden rounded-lg">
                      <img src={graphUrls.revenueOverTime} alt="Revenue over time graph" className="w-full" />
                    </div>
                  ) : (
                    <div className="w-full">
                      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Revenue line chart" className="w-full">
                        <defs>
                          <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.42" />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <line x1={CHART_PADDING} y1={CHART_PADDING} x2={CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.16)" />
                        <line x1={CHART_PADDING} y1={CHART_HEIGHT - CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.16)" />
                        {lineChart.areaPath ? <path d={lineChart.areaPath} fill="url(#revenueAreaGradient)" /> : null}
                        {lineChart.linePath ? <path d={lineChart.linePath} fill="none" stroke="#15803d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
                        {lineChart.points.map((point, index) => (
                          <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={4.5} fill="#166534" />
                        ))}
                      </svg>
                    </div>
                  )}
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    {(revenueTimeline.length ? revenueTimeline : [{ date: "", revenue: 0 }]).slice(0, 6).map((entry, index) => (
                      <span key={`${entry.date}-${index}`}>{formatAxisDate(entry.date)}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Top Products by Revenue</h3>
                    <p className="mt-1 text-sm text-slate-500">Your best performing products</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{revenueByProduct.length} products</span>
                </div>
                <div className="mt-6">
                  {graphUrls.revenueByProduct ? (
                    <div className="overflow-hidden rounded-lg">
                      <img src={graphUrls.revenueByProduct} alt="Revenue by product graph" className="w-full" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {!productRevenueBars.length ? <p className="text-sm text-slate-500">No product revenue data yet.</p> : null}
                      {productRevenueBars.map((entry) => (
                        <div key={entry.product} className="flex items-center gap-3">
                          <span className="w-24 truncate text-xs text-slate-600">{entry.product}</span>
                          <div className="flex-1 rounded-full bg-slate-100 h-6 overflow-hidden">
                            <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${entry.ratio}%` }} />
                          </div>
                          <strong className="w-20 text-right text-xs font-semibold text-slate-900">{compactMoney(entry.revenue)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Order Status Distribution</h3>
                    <p className="mt-1 text-sm text-slate-500">Current order fulfillment status</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{overview.summary.orders_total} total</span>
                </div>
                <div className="mt-6">
                  <div className="flex items-center gap-6">
                    <div className="h-32 w-32 rounded-full" style={{ background: orderMix?.conic || "conic-gradient(#d1d5db 0deg 360deg)" }} />
                    <div className="space-y-3">
                      {orderMix?.segments.map((segment) => (
                        <div key={segment.label} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                          <div className="h-3 w-3 rounded-full" style={{ background: segment.color }} />
                          <div>
                            <strong className="text-sm font-medium text-slate-900">{segment.label}</strong>
                            <span className="ml-2 text-xs text-slate-500">{segment.value} orders</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          {/* Insights & Details Section */}
          <div className="space-y-6 rounded-2xl bg-slate-50/50 p-6" key={`insights-${refreshTick}`}>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Business Insights</h2>
              <p className="mt-1 text-sm text-slate-500">Detailed analysis and operational insights</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-brand uppercase tracking-wider">Top Performer</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{highlightedProduct?.product || "No product data yet"}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {highlightedProduct
                    ? "Your strongest seller based on total units moved."
                    : "Start recording sales to surface your top-moving item."}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <span className="text-xs text-slate-500">Units sold</span>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      <AnimatedMetricValue value={Number(highlightedProduct?.units || 0)} variant="count" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <span className="text-xs text-slate-500">Revenue</span>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      <AnimatedMetricValue value={Number(highlightedProduct?.revenue || 0)} variant="money" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{completionRate}% completion rate</span>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">{inventoryCoverage}% stock health</span>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Demand by Category</h3>
                    <p className="mt-1 text-sm text-slate-500">Product category performance</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{demand.length} categories</span>
                </div>
                <div className="mt-6">
                  <div className="space-y-3">
                    {!demandChart.length ? <p className="text-sm text-slate-500">No category demand data yet.</p> : null}
                    {demandChart.map((entry) => (
                      <div key={entry.category} className="flex items-center gap-3">
                        <span className="w-24 truncate text-xs text-slate-600">{entry.category}</span>
                        <div className="flex-1 rounded-full bg-slate-100 h-6 overflow-hidden">
                          <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${entry.ratio}%` }} />
                        </div>
                        <strong className="w-20 text-right text-xs font-semibold text-slate-900">{entry.units} units</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Recent Sales</h3>
                    <p className="mt-1 text-sm text-slate-500">Latest revenue activity</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{recentSales.length} recent</span>
                </div>
                <div className="mt-6 space-y-3">
                  {!recentSales.length ? <p className="text-sm text-slate-500">No recent sales yet.</p> : null}
                  {recentSales.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <strong className="text-sm font-medium text-slate-900">{order.product || "Untitled product"}</strong>
                        <p className="mt-0.5 text-xs text-slate-500">{formatAxisDate(order.order_date)} · {order.category || "General"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Qty {order.quantity || 0}</span>
                        <strong className="text-sm font-semibold text-slate-900">{money(order.total || Number(order.quantity || 0) * Number(order.unit_price || 0))}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Inventory Alerts</h3>
                    <p className="mt-1 text-sm text-slate-500">Products needing attention</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{overview.inventory.alerts.length} alerts</span>
                </div>
                <div className="mt-6 space-y-3">
                  {!overview.inventory.alerts.length ? <p className="text-sm text-slate-500">Inventory is healthy.</p> : null}
                  {overview.inventory.alerts.map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <strong className="text-sm font-medium text-slate-900">{item.product_name}</strong>
                        <p className="mt-0.5 text-xs text-slate-500">Threshold: {item.low_stock_threshold} units</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{item.current_stock} left</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Forecasted stock-out risk</h3>
                    <p className="mt-1 text-sm text-slate-500">Predictive view based on your recent sales velocity.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{overview.inventory_forecast?.length || 0} items</span>
                </div>
                <div className="mt-6 space-y-3">
                  {!overview.inventory_forecast?.length ? <p className="text-sm text-slate-500">No forecast data yet.</p> : null}
                  {overview.inventory_forecast?.slice(0, 5).map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <strong className="text-sm font-medium text-slate-900">{item.product_name}</strong>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.current_stock} in stock · {item.daily_burn_rate.toFixed(1)} per day · {item.days_left} days left
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.risk_level === "critical" ? "bg-red-100 text-red-800" : item.risk_level === "watch" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                          {item.risk_level || "healthy"}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">Restock {item.recommended_restock || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          {/* Sales Activity Table */}
          <div className="overflow-x-auto rounded-2xl bg-slate-50/50 p-6" key={`table-${refreshTick}`}>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Sales Activity Ledger</h2>
                <p className="mt-1 text-sm text-slate-500">Complete transaction history and order details</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{recentOrders.length} records</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {!recentOrders.length ? <tr><td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">No order activity yet.</td></tr> : null}
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{formatDateTime(order.order_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{order.product || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{order.category || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{order.quantity || 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{money(order.total || Number(order.quantity || 0) * Number(order.unit_price || 0))}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{orderStatusLabel(order.status)}</td>
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
