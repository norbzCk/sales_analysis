import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import type { LogisticsUser } from "../types/domain";

const initialProfile: LogisticsUser = {
  id: 0,
  name: "",
  phone: "",
  email: "",
  account_type: "individual",
  vehicle_type: "",
  plate_number: "",
  license_number: "",
  base_area: "",
  coverage_areas: "",
  profile_photo: "",
  verification_status: "unverified",
};

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

export function LogisticsProfilePage() {
  const [profile, setProfile] = useState<LogisticsUser>(initialProfile);
  const [passwordDraft, setPasswordDraft] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<LogisticsUser>("/logistics/me");
      setProfile({ ...initialProfile, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logistics profile");
    } finally {
      setLoading(false);
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
      setProfile((prev) => ({ ...prev, profile_photo: response.image_url }));
      setFlash("Profile photo uploaded. Save profile to apply.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      const payload = {
        name: profile.name,
        phone: profile.phone,
        email: profile.email || null,
        account_type: profile.account_type,
        vehicle_type: profile.vehicle_type || null,
        plate_number: profile.plate_number || null,
        license_number: profile.license_number || null,
        base_area: profile.base_area || null,
        coverage_areas: profile.coverage_areas || null,
        profile_photo: profile.profile_photo || null,
      };

      const response = await apiRequest<{ user?: LogisticsUser; message?: string }>("/logistics/me", {
        method: "PUT",
        body: payload,
      });

      if (response.user) setProfile((prev) => ({ ...prev, ...response.user }));

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
      setEditing(false);
      setFlash(wantsPasswordChange ? "Profile and password updated." : response.message || "Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setPasswordUpdating(false);
    }
  }

  async function requestVerification() {
    setError("");
    setFlash("");
    try {
      await apiRequest("/logistics/verify", {
        method: "POST",
        body: {
          document_type: "logistics_profile",
          document_url: profile.profile_photo || null,
        },
      });
      setFlash("Verification request submitted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit verification");
    }
  }

  if (loading) {
    return <section className="panel"><p>Loading logistics profile...</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Logistics profile</p>
            <h1>Delivery account information</h1>
            <p className="muted">View and edit your logistics details.</p>
          </div>
          {!editing ? (
            <button className="secondary-button" type="button" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      {!editing ? (
        <article className="panel stack-list">
          <div className="panel-header">
            <h2>Account details</h2>
            <span className="role-chip">{profile.verification_status || "unverified"}</span>
          </div>
          {profile.profile_photo ? (
            <img
              src={resolveImageUrl(profile.profile_photo)}
              alt={profile.name || "Logistics profile"}
              style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div className="muted">No profile photo</div>
          )}
          <div className="list-card"><strong>Name</strong><span>{profile.name || "-"}</span></div>
          <div className="list-card"><strong>Email</strong><span>{profile.email || "-"}</span></div>
          <div className="list-card"><strong>Phone</strong><span>{profile.phone || "-"}</span></div>
          <div className="list-card"><strong>Account type</strong><span>{profile.account_type || "-"}</span></div>
          <div className="list-card"><strong>Vehicle type</strong><span>{profile.vehicle_type || "-"}</span></div>
          <div className="list-card"><strong>Plate number</strong><span>{profile.plate_number || "-"}</span></div>
          <div className="list-card"><strong>License number</strong><span>{profile.license_number || "-"}</span></div>
          <div className="list-card"><strong>Base area</strong><span>{profile.base_area || "-"}</span></div>
          <div className="list-card"><strong>Coverage areas</strong><span>{profile.coverage_areas || "-"}</span></div>
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={requestVerification}>
              Request verification ({profile.verification_status || "unverified"})
            </button>
          </div>
        </article>
      ) : (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleSubmit}>
          <label>Name<input value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} required /></label>
          <label>Email<input type="email" value={profile.email || ""} onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))} /></label>
          <label>Phone<input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} required /></label>
          <label>Account type<input value={profile.account_type} onChange={(e) => setProfile((prev) => ({ ...prev, account_type: e.target.value }))} required /></label>
          <label>Vehicle type<input value={profile.vehicle_type || ""} onChange={(e) => setProfile((prev) => ({ ...prev, vehicle_type: e.target.value }))} /></label>
          <label>Plate number<input value={profile.plate_number || ""} onChange={(e) => setProfile((prev) => ({ ...prev, plate_number: e.target.value }))} /></label>
          <label>License number<input value={profile.license_number || ""} onChange={(e) => setProfile((prev) => ({ ...prev, license_number: e.target.value }))} /></label>
          <label>Base area<input value={profile.base_area || ""} onChange={(e) => setProfile((prev) => ({ ...prev, base_area: e.target.value }))} /></label>
          <label>Coverage areas (comma separated)<input value={profile.coverage_areas || ""} onChange={(e) => setProfile((prev) => ({ ...prev, coverage_areas: e.target.value }))} /></label>

          <label>
            Upload profile photo (optional)
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
          <label>
            Profile photo URL (optional)
            <input value={profile.profile_photo || ""} onChange={(e) => setProfile((prev) => ({ ...prev, profile_photo: e.target.value }))} />
          </label>
          {profile.profile_photo ? (
            <img
              src={resolveImageUrl(profile.profile_photo)}
              alt="Profile preview"
              style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}

          <div className="full-width">
            <p className="eyebrow">Security (optional)</p>
          </div>
          <label>
            Current password
            <div className="password-input-wrapper">
              <input
                type={showPassword.current ? "text" : "password"}
                value={passwordDraft.current_password}
                onChange={(e) => setPasswordDraft((prev) => ({ ...prev, current_password: e.target.value }))}
              />
              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                aria-label={showPassword.current ? "Hide password" : "Show password"}
              >
                {showPassword.current ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </label>
          <label>
            New password
            <div className="password-input-wrapper">
              <input
                type={showPassword.new ? "text" : "password"}
                minLength={8}
                value={passwordDraft.new_password}
                onChange={(e) => setPasswordDraft((prev) => ({ ...prev, new_password: e.target.value }))}
              />
              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                aria-label={showPassword.new ? "Hide password" : "Show password"}
              >
                {showPassword.new ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </label>
          <label>
            Confirm new password
            <div className="password-input-wrapper">
              <input
                type={showPassword.confirm ? "text" : "password"}
                minLength={8}
                value={passwordDraft.confirm_password}
                onChange={(e) => setPasswordDraft((prev) => ({ ...prev, confirm_password: e.target.value }))}
              />
              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                aria-label={showPassword.confirm ? "Hide password" : "Show password"}
              >
                {showPassword.confirm ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </label>

          <div className="hero-actions">
            <button className="primary-button" type="submit" disabled={uploadingPhoto || passwordUpdating}>
              {uploadingPhoto || passwordUpdating ? "Saving..." : "Save profile"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditing(false);
                setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
                void load(); // reload original data
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
