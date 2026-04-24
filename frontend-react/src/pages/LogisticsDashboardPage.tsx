import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { getStoredToken } from "../features/auth/authStorage";
import { StatCards } from "../components/ui/PageSections";
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

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function ActiveDeliveryManager({ delivery, currentUserId, onStatusUpdate }: { delivery: LogisticsDelivery, currentUserId: number | undefined, onStatusUpdate: () => void }) {
  const token = getStoredToken();
  const { messages, sendChat, sendLocation, isConnected } = useDeliverySocket(delivery.order_id as number, token);
  const [showChat, setShowChat] = useState(false);

  // Broadcast GPS location if in transit
  useEffect(() => {
    if (delivery.status !== "in_transit" || !isConnected) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => console.warn("GPS tracking error:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [delivery.status, isConnected, sendLocation]);

  const pickupCoords: [number, number] | null = delivery.pickup_lat && delivery.pickup_lng ? [delivery.pickup_lat, delivery.pickup_lng] : null;
  const destCoords: [number, number] | null = delivery.destination_lat && delivery.destination_lng ? [delivery.destination_lat, delivery.destination_lng] : null;
  const currentCoords: [number, number] | null = delivery.current_lat && delivery.current_lng ? [delivery.current_lat, delivery.current_lng] : null;

  return (
    <article className="glass-card overflow-hidden animate-soft-enter border-brand/20 shadow-brand/10 border-2">
      <div className="p-6 bg-brand-strong text-white flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Active Mission</span>
          <h3 className="text-xl font-display font-black tracking-tight">Order #{delivery.order_id}</h3>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowChat(!showChat)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {showChat ? 'Close Chat' : 'Chat Buyer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-100">
        <div className="bg-white p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</span>
              <p className="text-sm font-bold text-slate-900 leading-tight">{delivery.pickup_location}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destination</span>
              <p className="text-sm font-bold text-slate-900 leading-tight">{delivery.delivery_location}</p>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3 border-t border-slate-100">
             {delivery.status === "assigned" && (
                <button onClick={() => onStatusUpdate()} className="w-full btn-primary !py-4">Confirm Pickup</button>
             )}
             {delivery.status === "picked_up" && (
                <button onClick={() => onStatusUpdate()} className="w-full btn-primary !py-4 bg-orange-500 hover:bg-orange-600">Start Live Delivery</button>
             )}
             {delivery.status === "in_transit" && (
                <button onClick={() => onStatusUpdate()} className="w-full btn-primary !py-4 bg-emerald-600 hover:bg-emerald-700">Finish Delivery</button>
             )}
          </div>
        </div>

        <div className="bg-white">
          {showChat ? (
            <DeliveryChat 
              messages={messages} 
              onSend={sendChat} 
              currentUserId={currentUserId} 
              otherPartyName="Buyer" 
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
  const [profileDraft, setProfileDraft] = useState<LogisticsProfile | null>(null);
  const [passwordDraft, setPasswordDraft] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

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

  const totalCompleted = Math.max(Number(metrics.total_deliveries || 0), deliverySummary.completed);
  
  const statItems = useMemo(
    () => [
      { id: "delivery-role", label: "Role", value: "Delivery Agent", note: "Workspace scoped to your assigned deliveries." },
      { id: "delivery-status", label: "Status", value: String(profile?.status || "-"), note: "Your current rider availability state." },
      { id: "delivery-availability", label: "Availability", value: String(profile?.availability || "-"), note: "Shown to dispatch when assigning work." },
      { id: "delivery-assigned", label: "Assigned", value: deliverySummary.assigned, note: "Ready for pickup or waiting for action." },
      { id: "delivery-transit", label: "In Transit", value: deliverySummary.inTransit, note: "Packages currently on the road." },
      { id: "delivery-completed", label: "Completed", value: totalCompleted, note: "Delivered jobs recorded for your account." },
      { id: "delivery-success", label: "Success Rate", value: `${Number(metrics.success_rate || 0).toFixed(0)}%`, note: "Based on logistics metrics from the backend." },
      { id: "delivery-rating", label: "Rating", value: Number(metrics.rating || 0).toFixed(1), note: "Average delivery feedback score." },
    ],
    [deliverySummary.assigned, deliverySummary.inTransit, metrics.rating, metrics.success_rate, profile?.availability, profile?.status, totalCompleted],
  );

  useEffect(() => {
    if (user?.role === "logistics") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [profileData, deliveriesData] = await Promise.all([
        apiRequest<LogisticsProfile>("/logistics/me"),
        apiRequest<{ deliveries: LogisticsDelivery[] }>("/logistics/deliveries"),
      ]);
      setProfile(profileData);
      setProfileDraft(profileData);
      setDeliveries(deliveriesData.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logistics dashboard");
    } finally {
      setLoading(false);
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDraft) return;
    setError("");
    setFlash("");
    try {
      const wantsPasswordChange =
        Boolean(passwordDraft.current_password) ||
        Boolean(passwordDraft.new_password) ||
        Boolean(passwordDraft.confirm_password);
      if (wantsPasswordChange) {
        if (!passwordDraft.current_password || !passwordDraft.new_password || !passwordDraft.confirm_password) {
          setError("Fill all password fields to change password.");
          return;
        }
        if (passwordDraft.new_password !== passwordDraft.confirm_password) {
          setError("New passwords do not match.");
          return;
        }
      }

      const response = await apiRequest<{ message?: string; user?: LogisticsProfile }>("/logistics/me", {
        method: "PUT",
        body: {
          name: profileDraft.name || null,
          email: profileDraft.email || null,
          phone: profileDraft.phone || null,
          vehicle_type: profileDraft.vehicle_type || null,
          plate_number: profileDraft.plate_number || null,
          license_number: profileDraft.license_number || null,
          base_area: profileDraft.base_area || null,
          coverage_areas: profileDraft.coverage_areas || null,
          profile_photo: profileDraft.profile_photo || null,
        },
      });
      if (response.user) {
        setProfile(response.user);
        setProfileDraft(response.user);
      } else {
        await load();
      }
      if (wantsPasswordChange) {
        setPasswordUpdating(true);
        await apiRequest("/logistics/change-password", {
          method: "POST",
          body: {
            current_password: passwordDraft.current_password,
            new_password: passwordDraft.new_password,
          },
        });
      }
      setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
      setEditingProfile(false);
      setFlash(wantsPasswordChange ? "Profile and password updated." : response.message || "Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setPasswordUpdating(false);
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setFlash("");
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await apiRequest<{ image_url: string }>("/logistics/upload-profile-photo", {
        method: "POST",
        body: form,
      });
      setProfileDraft((prev) => (prev ? { ...prev, profile_photo: response.image_url } : prev));
      setFlash("Profile photo uploaded. Save profile to apply.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function updateDelivery(id: number, status: string) {
    const verification = status === "delivered" ? window.prompt("Enter verification code (Check with Buyer)") || "" : "";
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
    return <section className="p-8"><h1>Logistics dashboard</h1><p className="muted">This route is only for logistics accounts.</p></section>;
  }

  const activeDelivery = deliveries.find(d => ["assigned", "picked_up", "in_transit"].includes(d.status));

  return (
    <div className="p-4 md:p-8 space-y-10 animate-soft-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">Logistics Command Center</span>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">Partner Dashboard</h1>
          <p className="text-slate-500 font-medium text-lg">Manage routes, status, and live customer communication.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => updateAvailability("status", profile?.status === "online" ? "offline" : "online")}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg
              ${profile?.status === 'online' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}
            `}
          >
            {profile?.status === 'online' ? '● System Online' : '○ Go Online'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-bold flex items-center gap-3 border border-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex items-center gap-3 border border-emerald-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {flash}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="glass-card p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rider ID</span>
          <strong className="text-xl font-display font-black text-slate-900">#L{profile?.id}</strong>
        </article>
        <article className="glass-card p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned</span>
          <strong className="text-xl font-display font-black text-brand">{deliverySummary.assigned}</strong>
        </article>
        <article className="glass-card p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rating</span>
          <strong className="text-xl font-display font-black text-accent">{Number(metrics.rating || 0).toFixed(1)}</strong>
        </article>
        <article className="glass-card p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Success</span>
          <strong className="text-xl font-display font-black text-slate-900">{Number(metrics.success_rate || 0).toFixed(0)}%</strong>
        </article>
      </div>

      {activeDelivery && (
        <section className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Active Delivery Workflow</h2>
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
        <div className="lg:col-span-2 space-y-8">
          <article className="glass-card p-0 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-1 w-full md:w-auto">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fulfillment Log</span>
                <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Delivery History</h2>
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-6 py-2 bg-slate-50 border-2 border-transparent focus:border-brand/20 rounded-xl outline-none transition-all font-semibold text-xs appearance-none cursor-pointer"
              >
                <option value="all">All Records</option>
                <option value="delivered">Delivered</option>
                <option value="assigned">Pending Pickup</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100">
              {!visibleDeliveries.length ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">No delivery records found</div>
              ) : (
                visibleDeliveries.map((delivery) => (
                  <div key={delivery.id} className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:bg-slate-50/50 transition-colors group">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand/5 flex items-center justify-center text-brand font-black text-xs">
                        #{delivery.order_id}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 leading-none">To: {delivery.delivery_location}</h4>
                        <p className="text-xs font-semibold text-slate-400">From: {delivery.pickup_location}</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter
                          ${delivery.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/10 text-brand'}
                        `}>{delivery.status}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fee Earned</span>
                      <strong className="text-lg font-display font-black text-slate-900">TZS {Number(delivery.price || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <aside className="space-y-8">
           <article className="glass-card p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                 <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-white shadow-2xl relative group">
                    <img src={resolveImageUrl(profile?.profile_photo)} alt={profile?.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-brand/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <label className="cursor-pointer p-2 bg-white rounded-full shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                       </label>
                    </div>
                 </div>
                 <div>
                    <h3 className="text-xl font-display font-black text-slate-900 leading-none mb-1">{profile?.name}</h3>
                    <span className="px-3 py-1 bg-brand/5 text-brand rounded-full text-[10px] font-black uppercase tracking-widest border border-brand/10">
                       Verified Rider
                    </span>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Vehicle</span>
                    <span className="text-slate-900 font-black">{profile?.vehicle_type || 'Motorcycle'}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Plate</span>
                    <span className="text-slate-900 font-black">{profile?.plate_number || '-'}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Base</span>
                    <span className="text-slate-900 font-black">{profile?.base_area || 'Central'}</span>
                 </div>
              </div>

              <button 
                onClick={() => setEditingProfile(true)}
                className="w-full py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-brand transition-all"
              >
                Manage Profile
              </button>
           </article>

           <article className="glass-card p-8 bg-brand-strong text-white border-none relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
              <div className="relative space-y-6">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Connectivity</span>
                    <h3 className="text-xl font-display font-black tracking-tight">System Status</h3>
                 </div>
                 <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-white/60">GPS SIGNAL</span>
                       <span className="text-[10px] font-black text-emerald-400">EXCELLENT</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-white/60">SOCKET API</span>
                       <span className="text-[10px] font-black text-emerald-400 uppercase">Synchronized</span>
                    </div>
                 </div>
              </div>
           </article>
        </aside>
      </div>
    </div>
  );
}
