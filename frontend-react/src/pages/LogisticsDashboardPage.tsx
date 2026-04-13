import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import type { LogisticsDelivery } from "../types/domain";

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

export function LogisticsDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LogisticsProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<LogisticsProfile | null>(null);
  const [passwordDraft, setPasswordDraft] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [deliveries, setDeliveries] = useState<LogisticsDelivery[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  useEffect(() => {
    if (user?.role === "logistics") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    setError("");
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
    const verification = status === "delivered" ? window.prompt("Enter verification code") || "" : "";
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
    return <section className="panel"><h1>Logistics dashboard</h1><p className="muted">This route is only for logistics accounts.</p></section>;
  }

  const metrics = profile?.metrics || {};

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Logistics dashboard</p>
        <h1>Delivery partner workspace</h1>
        <p className="muted">Track your rider status, delivery workload, account details, and password security from one place.</p>
      </div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Role</span><strong>Delivery Agent</strong></article>
        <article className="stat-card"><span className="stat-label">Status</span><strong>{String(profile?.status || "-")}</strong></article>
        <article className="stat-card"><span className="stat-label">Availability</span><strong>{String(profile?.availability || "-")}</strong></article>
        <article className="stat-card"><span className="stat-label">Deliveries</span><strong>{metrics.total_deliveries || 0}</strong></article>
        <article className="stat-card"><span className="stat-label">Success rate</span><strong>{metrics.success_rate || 0}</strong></article>
      </div>

      {!editingProfile ? (
        <article className="panel stack-list">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Account details</p>
              <h2>{profile?.name || "Delivery profile"}</h2>
            </div>
            <div className="hero-actions">
              <span className="role-chip">{profile?.verification_status || "unverified"}</span>
              <button className="secondary-button" type="button" onClick={() => setEditingProfile(true)}>
                Edit profile
              </button>
            </div>
          </div>
          {profile?.profile_photo ? (
            <img
              src={resolveImageUrl(profile.profile_photo)}
              alt={profile.name || "Delivery profile"}
              style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div className="muted">No profile photo</div>
          )}
          <div className="list-card"><strong>Phone</strong><span>{profile?.phone || "-"}</span></div>
          <div className="list-card"><strong>Email</strong><span>{profile?.email || "-"}</span></div>
          <div className="list-card"><strong>Vehicle</strong><span>{profile?.vehicle_type || "-"}</span></div>
          <div className="list-card"><strong>Plate</strong><span>{profile?.plate_number || "-"}</span></div>
          <div className="list-card"><strong>License</strong><span>{profile?.license_number || "-"}</span></div>
          <div className="list-card"><strong>Base area</strong><span>{profile?.base_area || "-"}</span></div>
          <div className="list-card"><strong>Coverage</strong><span>{profile?.coverage_areas || "-"}</span></div>
        </article>
      ) : (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleProfileSubmit}>
          <label>Name<input value={profileDraft?.name || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))} required /></label>
          <label>Email<input value={profileDraft?.email || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))} /></label>
          <label>Phone<input value={profileDraft?.phone || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))} required /></label>
          <label>Vehicle type<input value={profileDraft?.vehicle_type || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, vehicle_type: event.target.value } : prev))} /></label>
          <label>Plate number<input value={profileDraft?.plate_number || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, plate_number: event.target.value } : prev))} /></label>
          <label>License number<input value={profileDraft?.license_number || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, license_number: event.target.value } : prev))} /></label>
          <label>Base area<input value={profileDraft?.base_area || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, base_area: event.target.value } : prev))} /></label>
          <label>Coverage areas<input value={profileDraft?.coverage_areas || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, coverage_areas: event.target.value } : prev))} /></label>
          <label>
            Upload profile photo (optional)
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
          <label>
            Profile photo URL (optional)
            <input value={profileDraft?.profile_photo || ""} onChange={(event) => setProfileDraft((prev) => (prev ? { ...prev, profile_photo: event.target.value } : prev))} />
          </label>
          {profileDraft?.profile_photo ? (
            <img
              src={resolveImageUrl(profileDraft.profile_photo)}
              alt={profileDraft.name || "Profile preview"}
              style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}
          <div className="full-width">
            <p className="eyebrow">Security (optional)</p>
          </div>
          <label>
            Current password
            <input
              type="password"
              value={passwordDraft.current_password}
              onChange={(event) => setPasswordDraft((prev) => ({ ...prev, current_password: event.target.value }))}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              minLength={8}
              value={passwordDraft.new_password}
              onChange={(event) => setPasswordDraft((prev) => ({ ...prev, new_password: event.target.value }))}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              minLength={8}
              value={passwordDraft.confirm_password}
              onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirm_password: event.target.value }))}
            />
          </label>
          <div className="hero-actions">
            <button className="primary-button" type="submit">
              {uploadingPhoto || passwordUpdating ? "Saving..." : "Save profile"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingProfile(false);
                setProfileDraft(profile);
                setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="hero-actions">
        <button className="secondary-button" onClick={() => updateAvailability("status", "online")} type="button">Go online</button>
        <button className="secondary-button" onClick={() => updateAvailability("status", "offline")} type="button">Go offline</button>
        <button className="secondary-button" onClick={() => updateAvailability("availability", "available")} type="button">Available</button>
        <button className="secondary-button" onClick={() => updateAvailability("availability", "busy")} type="button">Busy</button>
      </div>

      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>Order</th><th>Pickup</th><th>Delivery</th><th>Status</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            {!deliveries.length ? <tr><td colSpan={6}>No deliveries assigned.</td></tr> : null}
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>#{delivery.order_id || "-"}</td>
                <td>{delivery.pickup_location}</td>
                <td>{delivery.delivery_location}</td>
                <td>{delivery.status}</td>
                <td>{delivery.price || "-"}</td>
                <td className="cell-actions">
                  {delivery.status === "assigned" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "picked_up")} type="button">Picked up</button> : null}
                  {delivery.status === "picked_up" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "in_transit")} type="button">In transit</button> : null}
                  {delivery.status === "in_transit" ? <button className="secondary-button" onClick={() => updateDelivery(delivery.id, "delivered")} type="button">Delivered</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
