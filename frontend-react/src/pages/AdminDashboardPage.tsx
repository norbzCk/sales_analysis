import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import type { DashboardAnalytics, DashboardChartPoint } from "../types/domain";

const CHART_WIDTH = 920;
const CHART_HEIGHT = 280;
const CHART_PADDING = 32;

const emptyAnalytics: DashboardAnalytics = {
  cards: [],
  revenueByProduct: [],
  revenueOverTime: [],
  recentSales: [],
};

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function formatCompactMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function resolveGraphUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${env.apiBase}${path}`;
  return `${env.apiBase}/${path.replace(/^\/+/, "")}`;
}

function buildGreenChart(points: DashboardChartPoint[]) {
  const values = points.map((point) => Number(point.value || 0));
  const safeValues = values.length ? values : [0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  const plotted = safeValues.map((value, index) => {
    const x = CHART_PADDING + (safeValues.length <= 1 ? innerWidth / 2 : (index / (safeValues.length - 1)) * innerWidth);
    const y = CHART_PADDING + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y, value };
  });

  const linePath = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = plotted.length
    ? `${linePath} L ${plotted[plotted.length - 1].x} ${CHART_HEIGHT - CHART_PADDING} L ${plotted[0].x} ${CHART_HEIGHT - CHART_PADDING} Z`
    : "";

  return { plotted, linePath, areaPath, min, max };
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(emptyAnalytics);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await apiRequest<DashboardAnalytics>("/dashboard/analytics");
        if (mounted) {
          setAnalytics({
            cards: data.cards || [],
            revenueByProduct: data.revenueByProduct || [],
            revenueOverTime: data.revenueOverTime || [],
            recentSales: data.recentSales || [],
          });
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

  const revenueTrendChart = useMemo(() => buildGreenChart(analytics.revenueOverTime), [analytics.revenueOverTime]);
  const maxProductRevenue = useMemo(
    () => Math.max(...analytics.revenueByProduct.map((item) => Number(item.value || 0)), 1),
    [analytics.revenueByProduct],
  );
  const revenueTimeGraphUrl = resolveGraphUrl(analytics.graphs?.revenueOverTime);
  const revenueProductGraphUrl = resolveGraphUrl(analytics.graphs?.revenueByProduct);

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
    <section className="panel-stack admin-dashboard">
      <div className="panel admin-overview-hero">
        <div>
          <p className="eyebrow">Business workspace</p>
          <h1>Business Overview</h1>
          <p className="muted">Live totals and trends from your recorded sales.</p>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {loading ? <p className="panel">Loading dashboard...</p> : null}

      {!loading ? (
        <>
          <div className="admin-stats-grid">
            {analytics.cards.map((card) => (
              <article key={card.id} className="stat-card admin-stat-card">
                <span className="stat-label">{card.label}</span>
                <strong>{card.display}</strong>
                <p className="muted">{card.subtitle}</p>
              </article>
            ))}
          </div>

          <div className="admin-chart-grid">
            <article className="panel admin-chart-panel admin-chart-panel--wide">
              <div className="panel-header">
                <div>
                  <h2>Revenue per time graph</h2>
                  <p className="muted">
                    {analytics.revenueOverTime.length
                      ? `Range: ${formatCompactMoney(revenueTrendChart.min)} to ${formatCompactMoney(revenueTrendChart.max)}`
                      : "No revenue trend available yet."}
                  </p>
                </div>
                <span>{analytics.revenueOverTime.length} points</span>
              </div>
              {revenueTimeGraphUrl ? (
                <div className="admin-green-graph">
                  <img src={revenueTimeGraphUrl} alt="Revenue per time graph" />
                </div>
              ) : (
                <div className="admin-green-graph admin-green-chart">
                  <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Revenue over time">
                    <defs>
                      <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16a34a" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity="0.06" />
                      </linearGradient>
                    </defs>
                    <line x1={CHART_PADDING} y1={CHART_PADDING} x2={CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.12)" />
                    <line x1={CHART_PADDING} y1={CHART_HEIGHT - CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} stroke="rgba(19, 33, 42, 0.12)" />
                    {revenueTrendChart.areaPath ? <path d={revenueTrendChart.areaPath} fill="url(#adminRevenueGradient)" /> : null}
                    {revenueTrendChart.linePath ? <path d={revenueTrendChart.linePath} fill="none" stroke="#15803d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
                    {revenueTrendChart.plotted.map((point, index) => (
                      <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={4.5} fill="#166534" />
                    ))}
                  </svg>
                </div>
              )}
              <div className="admin-chart-axis">
                {(analytics.revenueOverTime.length ? analytics.revenueOverTime : [{ label: "", value: 0 }]).slice(0, 7).map((point, index) => (
                  <span key={`${point.label}-${index}`}>{formatDateLabel(point.label)}</span>
                ))}
              </div>
            </article>

            <article className="panel admin-chart-panel">
              <div className="panel-header">
                <div>
                  <h2>Revenue per product graph</h2>
                  <p className="muted">Top products by earned revenue.</p>
                </div>
                <span>{analytics.revenueByProduct.length}</span>
              </div>
              {revenueProductGraphUrl ? (
                <div className="admin-green-graph">
                  <img src={revenueProductGraphUrl} alt="Revenue per product graph" />
                </div>
              ) : (
                <div className="admin-product-bars">
                  {!analytics.revenueByProduct.length ? <p className="muted">No product revenue data yet.</p> : null}
                  {analytics.revenueByProduct.map((item) => (
                    <div key={item.label} className="admin-product-bar">
                      <div className="admin-product-bar__header">
                        <strong>{item.label}</strong>
                        <span>{formatMoney(item.value)}</span>
                      </div>
                      <div className="admin-product-bar__track">
                        <div
                          className="admin-product-bar__fill"
                          style={{ width: `${Math.max(10, Math.round((Number(item.value || 0) / maxProductRevenue) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <div className="panel table-scroll">
            <div className="panel-header">
              <div>
                <h2>Recent sales</h2>
                <p className="muted">Latest sales recorded by the business.</p>
              </div>
              <span>{analytics.recentSales.length}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {!analytics.recentSales.length ? <tr><td colSpan={5}>No recent sales yet.</td></tr> : null}
                {analytics.recentSales.map((sale, index) => (
                  <tr key={`${sale.date || "sale"}-${index}`}>
                    <td>{formatDateLabel(sale.date)}</td>
                    <td>{sale.product || "-"}</td>
                    <td>{sale.category || "-"}</td>
                    <td>{sale.quantity || 0}</td>
                    <td>{formatMoney(sale.revenue)}</td>
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
