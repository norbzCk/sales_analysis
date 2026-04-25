import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  Package,
  Calendar,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from "lucide-react";
import { apiRequest } from "../lib/http";
import type { Order, SellerDashboardOverview } from "../types/domain";
import { env } from "../config/env";

interface RevenueRow {
  date: string;
  revenue: number;
}

interface ProductRevenueRow {
  product: string;
  revenue: number;
}

interface DemandRow {
  category: string;
  units: number;
}

interface SellerAnalyticsResponse {
  range_days: number;
  revenue_timeline: RevenueRow[];
  revenue_by_product: ProductRevenueRow[];
  demand_by_category: DemandRow[];
  graphs: {
    revenueByProduct: string | null;
    revenueOverTime: string | null;
  };
}

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export function SellerDashboardPage() {
  const [overview, setOverview] = useState<SellerDashboardOverview | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalyticsResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void load(true);
  }, [rangeDays]);

  async function load(initialLoad = false) {
    if (initialLoad) setLoading(true);
    if (!initialLoad) setRefreshing(true);
    setError("");

    try {
      const [overviewData, analyticsData, orderData] = await Promise.all([
        apiRequest<SellerDashboardOverview>("/business/dashboard/overview"),
        apiRequest<SellerAnalyticsResponse>(`/business/analytics?range_days=${rangeDays}`),
        apiRequest<{ items: Order[] }>("/business/orders"),
      ]);

      setOverview(overviewData);
      setAnalytics(analyticsData);
      setRecentOrders((orderData.items || []).slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seller dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const stats = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Today's Revenue", value: formatMoney(overview.summary.revenue_today), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", trend: "+12.5%", isPositive: true },
      { label: "Active Orders", value: overview.summary.orders_pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", trend: "Normal", isPositive: true },
      { label: "Total Sales", value: overview.summary.orders_total, icon: ShoppingBag, color: "text-brand", bg: "bg-brand/10", trend: "+8.2%", isPositive: true },
      { label: "Inventory Health", value: `${Math.round(((overview.inventory.total_products - (overview.inventory.low_stock + overview.inventory.out_of_stock)) / overview.inventory.total_products) * 100)}%`, icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10", trend: "-2.1%", isPositive: false },
    ];
  }, [overview]);

  function resolveGraphUrl(path?: string | null) {
    if (!path) return "";
    return `${env.apiBase}${path}?t=${Date.now()}`;
  }

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-brand/10 border-t-brand rounded-full animate-spin" />
        <p className="font-black text-[10px] uppercase tracking-[0.3em] text-text-muted animate-pulse">Synchronizing Business Intelligence...</p>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 max-w-7xl mx-auto"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand">Merchant Command Center</span>
          <h1 className="text-4xl font-display font-black text-text tracking-tight">Business Operations</h1>
          <p className="text-text-muted font-medium text-lg">Real-time performance metrics and predictive analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-surface border border-border p-1 rounded-2xl shadow-sm">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rangeDays === d ? 'bg-brand text-white shadow-lg' : 'text-text-muted hover:text-text'}`}
              >
                {d}D
              </button>
            ))}
          </div>
          <button 
            onClick={() => void load()}
            disabled={refreshing}
            className="h-12 px-6 flex items-center gap-3 rounded-2xl bg-surface-soft border border-border text-text font-black text-xs uppercase tracking-widest hover:bg-surface-strong transition-all disabled:opacity-50 active:scale-95"
          >
            <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Syncing..." : "Sync Network"}
          </button>
        </div>
      </div>

      {error && <div className="p-5 bg-danger/10 text-danger rounded-[2rem] font-bold border border-danger/20 animate-soft-enter">{error}</div>}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.article 
            key={stat.label}
            variants={itemVariants}
            className="stat-card group"
          >
            <div className="flex items-center justify-between">
              <span>{stat.label}</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className="flex items-end justify-between gap-4 mt-2">
              <strong className="text-3xl font-display font-black text-text leading-none">{stat.value}</strong>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${stat.isPositive ? 'text-emerald-500' : 'text-danger'}`}>
                {stat.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Revenue Growth - Main Chart Area */}
        <motion.article 
          variants={itemVariants}
          className="lg:col-span-2 glass-card p-10 flex flex-col space-y-10"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-display font-black text-text tracking-tight">Revenue Trajectory</h3>
              <p className="text-sm text-text-muted font-medium mt-1">Growth progression for the selected protocol cycle.</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-brand/5 border border-brand/10 text-brand font-black text-xs tracking-widest uppercase">
              <Activity size={16} />
              Live Performance
            </div>
          </div>
          
          <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden bg-surface-soft/50 border border-border flex items-center justify-center">
            {analytics?.graphs.revenueOverTime ? (
              <img 
                src={resolveGraphUrl(analytics.graphs.revenueOverTime)} 
                alt="Revenue Trend" 
                className="w-full h-full object-contain filter dark:invert dark:brightness-90 dark:contrast-125 dark:opacity-90"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-30">
                <BarChart3 size={48} />
                <p className="text-[10px] font-black uppercase tracking-widest">Generating trajectory mapping...</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analytics?.revenue_timeline.slice(-4).map(item => (
              <div key={item.date} className="p-4 rounded-xl bg-surface-soft border border-border">
                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <strong className="text-sm font-black text-text">{compactMoney(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </motion.article>

        {/* Inventory Overview */}
        <motion.article 
          variants={itemVariants}
          className="glass-card p-10 flex flex-col"
        >
          <div className="mb-10">
            <h3 className="text-2xl font-display font-black text-text tracking-tight">System Alerts</h3>
            <p className="text-sm text-text-muted font-medium mt-1">Stock-out predictions and risk vectors.</p>
          </div>

          <div className="space-y-6 flex-1">
            {overview?.inventory.alerts.slice(0, 6).map((alert, i) => (
              <div key={i} className="flex items-center gap-5 group cursor-pointer p-1 rounded-2xl hover:bg-surface-soft transition-colors">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 ${alert.current_stock === 0 ? 'bg-danger/10 border-danger/10 text-danger' : 'bg-amber-500/10 border-amber-500/10 text-amber-500'}`}>
                  <AlertTriangle size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-text truncate group-hover:text-brand transition-colors">{alert.product_name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mt-1">
                    {alert.current_stock} Units • Limit {alert.low_stock_threshold}
                  </p>
                </div>
                <ChevronRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
            {(!overview?.inventory.alerts.length) && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 py-10">
                <div className="w-20 h-20 rounded-[2.5rem] bg-surface-soft flex items-center justify-center border-2 border-dashed border-border text-emerald-500">
                  <CheckCircle2 size={40} />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em]">Inventory Optimized</p>
              </div>
            )}
          </div>

          <button className="w-full mt-10 py-5 rounded-[1.75rem] bg-surface-soft border border-border text-[10px] font-black uppercase tracking-[0.3em] text-text hover:bg-surface-strong transition-all shadow-sm active:scale-95">
            Detailed Inventory Report
          </button>
        </motion.article>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Recent Orders */}
        <motion.article 
          variants={itemVariants}
          className="glass-card overflow-hidden"
        >
          <div className="p-10 border-b border-border bg-surface-soft/30 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-black text-text tracking-tight">Recent Ledger</h3>
              <p className="text-sm text-text-muted font-medium">Real-time marketplace transactions.</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand bg-brand/10 px-4 py-2 rounded-full border border-brand/20">Active Node</span>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-8 flex items-center justify-between group hover:bg-surface-soft/60 transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-surface-soft flex items-center justify-center text-text-muted group-hover:bg-brand group-hover:text-white transition-all shadow-inner border border-border">
                    <ShoppingBag size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-display font-black text-text truncate group-hover:text-brand transition-colors">{order.product}</p>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                      {new Date(order.order_date).toLocaleDateString()} • {order.quantity} Units
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-display font-black text-text">{formatMoney(order.total)}</p>
                  <span className={`text-[10px] font-black uppercase tracking-widest mt-2 inline-block px-3 py-1 rounded-lg ${order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-8 bg-surface-soft/30 border-t border-border text-center">
            <button className="text-[10px] font-black uppercase tracking-[0.3em] text-brand hover:text-brand-strong transition-all flex items-center justify-center mx-auto gap-2 group">
              View Full Transactional Ledger
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.article>

        {/* Top Products - Trend Graph */}
        <motion.article 
          variants={itemVariants}
          className="glass-card p-10 space-y-10"
        >
          <div>
            <h3 className="text-2xl font-display font-black text-text tracking-tight">Product Performance</h3>
            <p className="text-sm text-text-muted font-medium mt-1">Market leaders by revenue generation.</p>
          </div>

          <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-surface-soft/50 border border-border flex items-center justify-center">
            {analytics?.graphs.revenueByProduct ? (
              <img 
                src={resolveGraphUrl(analytics.graphs.revenueByProduct)} 
                alt="Revenue by Product" 
                className="w-full h-full object-contain filter dark:invert dark:brightness-90 dark:contrast-125 dark:opacity-90"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-30">
                <BarChart3 size={48} />
                <p className="text-[10px] font-black uppercase tracking-widest">Mapping asset data...</p>
              </div>
            )}
          </div>
          
          <div className="pt-10 border-t border-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Protocol State</span>
              <span className="text-xs font-bold text-emerald-500">Live Growth Sync</span>
            </div>
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
        </motion.article>
      </div>
    </motion.div>
  );
}
