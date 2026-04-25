import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Truck, 
  X, 
  AlertTriangle,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Package,
  MapPin,
  Phone,
  FileText,
  Zap,
  Star,
  ChevronRight,
  CreditCard,
  MessageSquare,
  Navigation
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
import { apiRequest } from "../lib/http";
import { StatCards, SectionCard, PageIntro } from "../components/ui/PageSections";
import { Modal } from "../components/Modal";
import { DeliveryChat } from "../features/logistics/DeliveryChat";
import { useDeliverySocket } from "../features/logistics/useDeliverySocket";
import { LiveTrackingMap } from "../features/logistics/LiveTrackingMap";
import { getStoredToken } from "../features/auth/authStorage";
import type { LogisticsDelivery, Order, OrderTracking, Product } from "../types/domain";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const TRACKING_STEPS = ["Pending", "Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received"];
const STATUS_OPTIONS = ["Pending", "Confirmed", "Packed", "Ready For Shipping", "Shipped", "Received", "Cancelled"];

interface LogisticsOption {
  id: number;
  name: string;
}

interface BusinessmanOption {
  id: number;
  business_name: string;
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

function statusColor(status?: string) {
  const normalized = normalizedStatus(status);
  if (normalized === "Received") return "text-emerald-500 bg-emerald-500/10";
  if (normalized === "Cancelled") return "text-danger bg-danger/10";
  if (normalized === "Pending") return "text-amber-500 bg-amber-500/10";
  return "text-brand bg-brand/10";
}

export function OrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Chat & Tracking State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const activeOrder = useMemo(() => orders.find(o => o.id === selectedId), [orders, selectedId]);
  const token = getStoredToken();
  const { messages, sendChat, sendTyping, location: liveLoc, isConnected, isOtherPartyTyping } = useDeliverySocket(selectedId || undefined, token);

  const sellerMode = String(user?.role || "") === "seller";

  useEffect(() => {
    void load();
  }, [sellerMode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (sellerMode) {
        const orderData = await apiRequest<{ items: Order[] }>("/business/orders");
        setOrders(orderData.items || []);
      } else {
        const [orderData, productData] = await Promise.all([
          apiRequest<Order[]>("/orders/"),
          apiRequest<Product[]>("/products/"),
        ]);
        setOrders(Array.isArray(orderData) ? orderData : []);
        setProducts(Array.isArray(productData) ? productData : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to synchronize orders");
    } finally {
      setLoading(false);
    }
  }

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const haystack = `${order.product || ""} ${order.category || ""} ${order.provider_name || ""}`.toLowerCase();
      const okText = !q || haystack.includes(q);
      const okStatus = statusFilter === "all" || normalizedStatus(order.status) === statusFilter;
      return okText && okStatus;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => {
    if (!selectedId && visibleOrders.length) {
      setSelectedId(visibleOrders[0].id);
    }
  }, [selectedId, visibleOrders]);

  const orderStatusData = useMemo(() => {
    const counts = STATUS_OPTIONS.reduce((acc, status) => { acc[status] = 0; return acc; }, {} as Record<string, number>);
    orders.forEach((order) => {
      const status = normalizedStatus(order.status);
      if (counts.hasOwnProperty(status)) counts[status]++;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#3b82f6', '#8b5cf6', '#eab308', '#f97316', '#06b6d4', '#22c55e', '#ef4444'],
        borderWidth: 0,
      }],
    };
  }, [orders]);

  const statItems = useMemo(() => {
    const counts = orders.reduce((acc, order) => {
      const s = normalizedStatus(order.status);
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return [
      { id: "total", label: "Total Orders", value: orders.length, icon: <ShoppingBag size={18} /> },
      { id: "pending", label: "Pending", value: counts.Pending || 0, icon: <Clock size={18} /> },
      { id: "transit", label: "Shipped", value: counts.Shipped || 0, icon: <Truck size={18} /> },
      { id: "done", label: "Fulfilled", value: counts.Received || 0, icon: <CheckCircle2 size={18} /> },
    ];
  }, [orders]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <PageIntro 
        eyebrow="Order Protocols"
        title={sellerMode ? "Sales Command" : "Order History"}
        description={sellerMode ? "Manage incoming marketplace demand and fulfillment nodes." : "Track your procurement activity and direct communications."}
      />

      <StatCards items={statItems} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 bg-surface border border-border p-3 rounded-2xl shadow-sm">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ledger..."
                className="w-full pl-11 pr-4 py-2.5 bg-surface-soft rounded-xl outline-none font-bold text-xs"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-soft border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="all">All Stages</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="divide-y divide-border">
              {visibleOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  className={`w-full text-left p-6 flex items-center justify-between group transition-all ${selectedId === order.id ? 'bg-brand/5 border-l-4 border-l-brand' : 'hover:bg-surface-soft/40'}`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${statusColor(order.status)}`}>
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-brand uppercase tracking-widest">#{order.id}</span>
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{order.category || "General"}</span>
                      </div>
                      <h4 className="font-display font-black text-base text-text truncate group-hover:text-brand transition-colors">{order.product}</h4>
                      <p className="text-[10px] font-bold text-text-muted mt-1">{new Date(order.order_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-text">{formatMoney(order.total || (Number(order.unit_price) * Number(order.quantity)))}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest mt-1 block ${statusColor(order.status)} px-2 py-0.5 rounded-md text-center`}>
                      {normalizedStatus(order.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <SectionCard title="Lifecycle" description="Nexus transactional status.">
            <div className="h-56 relative flex items-center justify-center">
              <Pie 
                data={orderStatusData} 
                options={{ 
                  plugins: { legend: { display: false } }, 
                  maintainAspectRatio: false,
                  cutout: '75%'
                }} 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-display font-black text-text">{orders.length}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Total</span>
              </div>
            </div>
          </SectionCard>

          <AnimatePresence mode="wait">
            {activeOrder ? (
              <motion.div
                key={activeOrder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <article className="glass-card p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-black text-brand uppercase tracking-[0.2em]">Fulfillment Protocol</span>
                      <h3 className="text-xl font-display font-black text-text leading-tight mt-1">{activeOrder.product}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsChatOpen(true)}
                        className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all shadow-sm"
                      >
                        <MessageSquare size={18} />
                      </button>
                      {activeOrder.status === 'Shipped' && (
                        <button 
                          onClick={() => setIsMapOpen(true)}
                          className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        >
                          <Navigation size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-surface-soft border border-border">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Units</span>
                      <strong className="text-sm font-black text-text">{activeOrder.quantity}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-soft border border-border">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Settlement</span>
                      <strong className="text-sm font-black text-brand">{formatMoney(activeOrder.total)}</strong>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex gap-3">
                      <MapPin size={16} className="text-text-muted shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Target Hub</p>
                        <p className="text-xs font-bold text-text leading-tight mt-1">{activeOrder.delivery_address || "TBD"}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Truck size={16} className="text-text-muted shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Deployment Method</p>
                        <p className="text-xs font-bold text-text mt-1">{activeOrder.delivery_method || "Standard Sourcing"}</p>
                      </div>
                    </div>
                  </div>

                  {user?.role === "user" && normalizedStatus(activeOrder.status) === "Confirmed" && (
                    <button 
                      onClick={() => navigate(`/app/payments?order_id=${activeOrder.id}&amount=${activeOrder.total}`)}
                      className="btn-primary w-full h-14 !text-[10px] shadow-brand/40"
                    >
                      <CreditCard size={16} className="mr-2" />
                      Execute Payment Protocol
                    </button>
                  )}
                </article>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Communication Modal */}
      <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} title="Operational Comms">
        <div className="p-4">
          <DeliveryChat 
            messages={messages} 
            onSend={sendChat} 
            onTyping={sendTyping}
            currentUserId={user?.id} 
            otherPartyName={sellerMode ? "Buyer" : (activeOrder?.provider_name || "Merchant")} 
            isConnected={isConnected}
            isOtherPartyTyping={isOtherPartyTyping}
          />
        </div>
      </Modal>

      {/* Telemetry Modal */}
      <Modal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} title="Deployment Telemetry">
        <div className="p-4 space-y-4">
          <div className="h-[400px] rounded-2xl overflow-hidden border border-border shadow-inner">
            <LiveTrackingMap 
              currentLocation={liveLoc ? [liveLoc.lat, liveLoc.lng] : null}
              destination={activeOrder ? [0,0] : null} // Map component handles lookup if coords missing
              pickup={null}
            />
          </div>
          <div className="flex justify-between items-center bg-surface-soft p-4 rounded-xl border border-border">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Live GPS Signal</span>
             </div>
             <span className="text-xs font-bold text-text-muted italic">Rider: {liveLoc?.rider_name || "Syncing..."}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
