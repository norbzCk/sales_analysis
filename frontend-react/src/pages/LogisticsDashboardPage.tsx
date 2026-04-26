import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Truck, 
  MapPin, 
  CheckCircle2, 
  X, 
  MessageSquare, 
  Navigation, 
  Star, 
  ChevronRight, 
  ShieldCheck, 
  Activity,
  User as UserIcon,
  Phone,
  Package,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { getStoredToken } from "../features/auth/authStorage";
import { PageIntro, StatCards, SectionCard } from "../components/ui/PageSections";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery } from "../types/domain";
import { useDeliverySocket } from "../features/logistics/useDeliverySocket";
import { LiveTrackingMap } from "../features/logistics/LiveTrackingMap";
import { DeliveryChat } from "../features/logistics/DeliveryChat";

interface LogisticsProfile {
  id: number;
  role?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  account_type?: string;
  vehicle_type?: string | null;
  plate_number?: string | null;
  license_number?: string | null;
  base_area?: string | null;
  coverage_areas?: string | null;
  status?: string;
  availability?: string;
  profile_photo?: string | null;
  verification_status?: string;
  metrics?: {
    rating?: number;
    total_deliveries?: number;
    success_rate?: number;
    cancel_rate?: number;
  };
}

function formatMoney(value?: number | null) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function ActiveDeliveryManager({ delivery, currentUserId, onStatusUpdate }: { delivery: LogisticsDelivery, currentUserId: number | undefined, onStatusUpdate: () => void }) {
  const token = getStoredToken();
  const { messages, sendChat, sendLocation, sendTyping, isConnected, isOtherPartyTyping } = useDeliverySocket(delivery.order_id as number, token);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (delivery.status !== "in_transit" || !isConnected) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn("GPS tracking error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [delivery.status, isConnected, sendLocation]);

  const pickupCoords: [number, number] | null = delivery.pickup_lat && delivery.pickup_lng ? [delivery.pickup_lat, delivery.pickup_lng] : null;
  const destCoords: [number, number] | null = delivery.destination_lat && delivery.destination_lng ? [delivery.destination_lat, delivery.destination_lng] : null;
  const currentCoords: [number, number] | null = delivery.current_lat && delivery.current_lng ? [delivery.current_lat, delivery.current_lng] : null;

  return (
    <article className="glass-card overflow-hidden border-brand/20 shadow-xl">
      <div className="p-6 bg-brand-strong text-white flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Active Operation</span>
          <h3 className="text-xl font-display font-black tracking-tight">Deployment #{delivery.order_id}</h3>
        </div>
        <button 
          onClick={() => setShowChat(!showChat)}
          className="h-10 px-5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"
        >
          <MessageSquare size={14} />
          {showChat ? 'Close Comms' : 'Sync Buyer'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        <div className="bg-surface p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Origin Node</span>
              <p className="text-sm font-bold text-text leading-tight">{delivery.pickup_location}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Target Node</span>
              <p className="text-sm font-bold text-text leading-tight">{delivery.delivery_location}</p>
            </div>
          </div>

          <div className="pt-6 flex flex-col gap-3 border-t border-border">
             {delivery.status === "assigned" && (
                <button onClick={() => onStatusUpdate()} className="btn-primary w-full !h-14">Confirm Pickup Protocol</button>
             )}
             {delivery.status === "picked_up" && (
                <button onClick={() => onStatusUpdate()} className="btn-primary w-full !h-14 !bg-orange-500 hover:!bg-orange-600">Initiate Transit</button>
             )}
             {delivery.status === "in_transit" && (
                <button onClick={() => onStatusUpdate()} className="btn-primary w-full !h-14 !bg-emerald-600 hover:!bg-emerald-700">Verify Final Receipt</button>
             )}
          </div>
        </div>

        <div className="bg-surface-soft min-h-[300px]">
          {showChat ? (
            <DeliveryChat 
              messages={messages} 
              onSend={sendChat} 
              onTyping={sendTyping}
              currentUserId={currentUserId} 
              otherPartyName="Buyer" 
              isConnected={isConnected}
              isOtherPartyTyping={isOtherPartyTyping}
            />
          ) : (
            <LiveTrackingMap 
              currentLocation={currentCoords}
              destination={destCoords}
              pickup={pickupCoords}
            />
          )}
        </div>
      </div>
    </article>
  );
}

export function LogisticsDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LogisticsProfile | null>(null);
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);

  const metrics = profile?.metrics || {};
  const deliverySummary = useMemo(() => {
    const assigned = deliveries.filter((item) => item.status === "assigned").length;
    const inTransit = deliveries.filter((item) => item.status === "picked_up" || item.status === "in_transit").length;
    const completed = deliveries.filter((item) => item.status === "delivered").length;
    return { assigned, inTransit, completed };
  }, [deliveries]);
  
  const visibleDeliveries = useMemo(() => {
    if (statusFilter === "all") return deliveries;
    return deliveries.filter((item) => item.status === statusFilter);
  }, [deliveries, statusFilter]);

  const statItems = useMemo(
    () => [
      { id: "id", label: "Fleet Identity", value: `#L${profile?.id || '—'}`, icon: <Truck size={18} />, note: profile?.account_type || "Agent" },
      { id: "status", label: "Protocol State", value: profile?.status || "Offline", icon: <Activity size={18} />, note: profile?.availability || "Status" },
      { id: "assigned", label: "Active Jobs", value: deliverySummary.assigned, icon: <Package size={18} /> },
      { id: "rating", label: "Trust Rating", value: Number(metrics.rating || 0).toFixed(1), icon: <Star size={18} /> },
    ],
    [profile, deliverySummary.assigned, metrics.rating]
  );

  useEffect(() => {
    if (user?.role === "logistics") void load();
  }, [user?.role]);

  async function load() {
    setLoading(true);
    try {
      const [profileData, deliveriesData] = await Promise.all([
        apiRequest<LogisticsProfile>("/logistics/me"),
        apiRequest<{ deliveries: LogisticsDelivery[] }>("/logistics/deliveries"),
      ]);
      setProfile(profileData);
      setDeliveries(deliveriesData.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "System sync failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateAvailability(type: "status" | "availability", value: string) {
    try {
      await apiRequest(`/logistics/${type}`, { method: "PUT", body: { [type]: value } });
      setFlash(`${type} successfully synchronized.`);
      await load();
    } catch (err) {
      setError("Protocol update failed.");
    }
  }

  async function updateDelivery(id: number, status: string) {
    const verification = status === "delivered" ? window.prompt("Enter verification code (Check with Buyer)") || "" : "";
    try {
      await apiRequest(`/logistics/deliveries/${id}/status`, {
        method: "PUT",
        body: { status, verification_code: verification || undefined },
      });
      setFlash(`Job updated to ${status}.`);
      await load();
    } catch (err) {
      setError("Fulfillment update failed.");
    }
  }

  if (loading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-brand/10 border-t-brand rounded-full animate-spin" />
      <p className="font-black text-[10px] uppercase tracking-[0.3em] text-text-muted animate-pulse">Syncing Fulfillment Node...</p>
    </div>
  );

  const activeDelivery = deliveries.find(d => ["assigned", "picked_up", "in_transit"].includes(d.status));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageIntro 
        eyebrow="Logistics Mesh"
        title="Agent Command Center"
        description="Monitor assignments, coordinate real-time delivery routes, and manage system availability across the network."
        actions={
          <button 
            onClick={() => updateAvailability("status", profile?.status === "online" ? "offline" : "online")}
            className={`h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl
              ${profile?.status === 'online' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-surface-strong text-text-muted hover:text-text'}
            `}
          >
            {profile?.status === 'online' ? '● Node Online' : '○ Go Online'}
          </button>
        }
      />

      <StatCards items={statItems} />

      {error && <div className="p-4 bg-danger/10 text-danger rounded-2xl font-bold border border-danger/20 text-xs animate-soft-enter">{error}</div>}
      {flash && <div className="p-4 bg-accent/10 text-accent rounded-2xl font-bold border border-accent/20 text-xs animate-soft-enter">{flash}</div>}

      {activeDelivery && (
        <section className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-text">Critical Mission Active</h2>
          </div>
          <ActiveDeliveryManager 
            delivery={activeDelivery} 
            currentUserId={user?.id}
            onStatusUpdate={() => {
               const next = activeDelivery.status === "assigned" ? "picked_up" : 
                            activeDelivery.status === "picked_up" ? "in_transit" : "delivered";
               updateDelivery(activeDelivery.id, next);
            }}
          />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SectionCard 
            title="Operational Ledger" 
            description="Historical log of fulfillment protocols."
            action={
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-surface-soft border border-border rounded-xl outline-none font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              >
                <option value="all">Full Ledger</option>
                <option value="delivered">Completed</option>
                <option value="assigned">Pending</option>
              </select>
            }
          >
            <div className="divide-y divide-border -mx-8 -mb-8">
              {!visibleDeliveries.length ? (
                <div className="p-12 text-center text-text-muted text-[10px] font-black uppercase tracking-[0.2em] opacity-40">No records synchronized.</div>
              ) : (
                visibleDeliveries.map((delivery) => (
                  <div key={delivery.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:bg-surface-soft/40 transition-colors group">
                    <div className="flex gap-5">
                      <div className="w-12 h-12 rounded-xl bg-brand/5 border border-brand/20 flex items-center justify-center text-brand font-black text-xs">
                        #{delivery.order_id}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-text leading-none group-hover:text-brand transition-colors">Target: {delivery.delivery_location}</h4>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">From: {delivery.pickup_location}</p>
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter mt-1
                          ${delivery.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand/10 text-brand'}
                        `}>{delivery.status}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Settlement</span>
                      <strong className="text-lg font-display font-black text-text">{formatMoney(delivery.price)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-8">
           <article className="glass-card p-8 flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-[2.5rem] overflow-hidden border-4 border-surface shadow-2xl relative group bg-surface-soft">
                 {profile?.profile_photo ? (
                   <img src={resolveImageUrl(profile.profile_photo)} alt={profile.name} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-brand font-black text-3xl">
                     {(profile?.name || "R")[0].toUpperCase()}
                   </div>
                 )}
              </div>
              <div>
                 <h3 className="text-xl font-display font-black text-text tracking-tight">{profile?.name}</h3>
                 <span className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-brand/10 text-brand rounded-lg text-[10px] font-black uppercase tracking-widest border border-brand/20">
                    <ShieldCheck size={12} />
                    Verified Node
                 </span>
              </div>

              <div className="w-full space-y-4 pt-6 border-t border-border">
                 {[
                   { label: 'Vehicle', val: profile?.vehicle_type || 'Fleet Default' },
                   { label: 'Asset ID', val: profile?.plate_number || 'Fleet-X' },
                   { label: 'Base Area', val: profile?.base_area || 'Central' }
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">{item.label}</span>
                      <span className="text-xs font-black text-text">{item.val}</span>
                   </div>
                 ))}
              </div>

              <button className="w-full h-12 bg-dark-bg text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-brand transition-all shadow-xl active:scale-95">
                Manage Profile
              </button>
           </article>

           <article className="glass-card p-8 bg-dark-bg text-white border-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Navigation size={60} />
              </div>
              <div className="relative space-y-6">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Telemetry Sync</span>
                    <h3 className="text-xl font-display font-black tracking-tight">System Integrity</h3>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">GPS Payload</span>
                       <span className="text-[10px] font-black text-emerald-400">NOMINAL</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Data Stream</span>
                       <span className="text-[10px] font-black text-emerald-400">ACTIVE</span>
                    </div>
                 </div>
              </div>
           </article>
        </aside>
      </div>
    </div>
  );
}

