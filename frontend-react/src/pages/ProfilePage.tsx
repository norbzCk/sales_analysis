import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";
import { Modal } from "../components/Modal"; // This import should now resolve

interface ProfileState {
  name: string;
  email: string;
  phone: string;
  address: string;
  profile_photo: string;
}

interface PasswordState {
  current_password: "";
  new_password: "";
  confirm_password: "";
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function getInitials(name?: string) {
  const text = String(name || "User").trim();
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileState>({ name: "", email: "", phone: "", address: "", profile_photo: "" });
  const [passwordDraft, setPasswordDraft] = useState<PasswordState>({ current_password: "", new_password: "", confirm_password: "" });
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      profile_photo: user?.profile_photo || "",
    });
  }, [user]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    try {
      const updated = await apiRequest<{
        name: string;
        email: string;
        phone?: string;
        address?: string;
        profile_photo?: string;
      }>("/auth/me", {
        method: "PUT",
        body: {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          profile_photo: profile.profile_photo || null,
        },
      });
      setProfile({
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        address: updated.address || "",
        profile_photo: updated.profile_photo || "",
      });
      await refreshUser();

      setEditing(false);
      setFlash("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    setPasswordUpdating(true);

    if (!passwordDraft.current_password || !passwordDraft.new_password || !passwordDraft.confirm_password) {
      setError("Fill all password fields to change password.");
      setPasswordUpdating(false);
      return;
    }
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setError("New passwords do not match.");
      setPasswordUpdating(false);
      return;
    }

    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: {
          current_password: passwordDraft.current_password,
          new_password: passwordDraft.new_password,
        },
      });
      setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
      setShowPasswordModal(false);
      setFlash("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
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
      const response = await apiRequest<{ image_url: string }>("/auth/upload-profile-photo", {
        method: "POST",
        body: form,
      });
      setProfile((state) => ({ ...state, profile_photo: response.image_url }));
      setFlash("Profile photo uploaded. Save profile to apply.");
      setShowPhotoModal(false); // Close modal after upload
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  if (user?.role !== "user") {
    return <section className="panel"><h1>Profile</h1><p className="muted">The legacy profile screen is only available for customer accounts.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profile</p>
            <h1>Your account information</h1>
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
            <div className="profile-avatar-section">
              {profile.profile_photo ? (
                <img
                  src={resolveImageUrl(profile.profile_photo)}
                  alt={profile.name || "Profile"}
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar-placeholder">
                  <span>{getInitials(profile.name || "User")}</span>
                </div>
              )}
              <div>
                <h2>{profile.name || "User"}</h2>
                <p className="muted">Account profile</p>
              </div>
            </div>
            <div className="profile-actions">
              <button className="secondary-button" type="button" onClick={() => setShowPhotoModal(true)}>
                Change Photo
              </button>
              <button className="secondary-button" type="button" onClick={() => setShowPasswordModal(true)}>
                Change Password
              </button>
            </div>
          </div>
          <div className="list-card"><strong>Name</strong><span>{profile.name || "-"}</span></div>
          <div className="list-card"><strong>Email</strong><span>{profile.email || "-"}</span></div>
          <div className="list-card"><strong>Phone</strong><span>{profile.phone || "-"}</span></div>
          <div className="list-card"><strong>Address</strong><span>{profile.address || "-"}</span></div>
        </article>
      ) : (
        <form className="panel form-grid" onSubmit={handleProfileSubmit}>
          <h2>Edit profile</h2>
          <label>Name<input value={profile.name} onChange={(event) => setProfile((state) => ({ ...state, name: event.target.value }))} required /></label>
          <label>Email<input value={profile.email} readOnly /></label>
          <label>Phone<input value={profile.phone} onChange={(event) => setProfile((state) => ({ ...state, phone: event.target.value }))} /></label>
          <label>Address<input value={profile.address} onChange={(event) => setProfile((state) => ({ ...state, address: event.target.value }))} /></label>
          
          <div className="full-width">
            <p className="eyebrow">Security</p>
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
                setEditing(false);
                setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Change Photo Modal */}
      <Modal isOpen={showPhotoModal} onClose={() => setShowPhotoModal(false)} title="Change Profile Photo">
        <form onSubmit={(e) => e.preventDefault()} className="form-grid">
          <label>
            Upload new photo
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
          <label>
            Or enter photo URL
            <input
              value={profile.profile_photo}
              onChange={(event) => setProfile((state) => ({ ...state, profile_photo: event.target.value }))}
              placeholder="/uploads/profile-photo.jpg or https://example.com/avatar.png"
            />
          </label>
          {profile.profile_photo ? (
            <img
              src={resolveImageUrl(profile.profile_photo)}
              alt="Profile preview"
              style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={handleProfileSubmit} disabled={uploadingPhoto}>
              {uploadingPhoto ? "Uploading..." : "Save Photo"}
            </button>
            <button className="secondary-button" type="button" onClick={() => setShowPhotoModal(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password">
        <form onSubmit={handlePasswordSubmit} className="form-grid">
          <label>
            Current password
            <div className="password-input-wrapper">
              <input
                type={showPassword.current ? "text" : "password"}
                value={passwordDraft.current_password}
                onChange={(event) => setPasswordDraft((prev) => ({ ...prev, current_password: event.target.value }))}
                required
              />
              <button type="button" className="password-toggle-button" onClick={() => setShowPassword(prev => ({...prev, current: !prev.current}))}>
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
                onChange={(event) => setPasswordDraft((prev) => ({ ...prev, new_password: event.target.value }))}
                required
              />
              <button type="button" className="password-toggle-button" onClick={() => setShowPassword(prev => ({...prev, new: !prev.new}))}>
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
                onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirm_password: event.target.value }))}
                required
              />
              <button type="button" className="password-toggle-button" onClick={() => setShowPassword(prev => ({...prev, confirm: !prev.confirm}))}>
                {showPassword.confirm ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </label>
          <div className="hero-actions">
            <button className="primary-button" type="submit" disabled={passwordUpdating}>
              {passwordUpdating ? "Updating..." : "Update Password"}
            </button>
            <button className="secondary-button" type="button" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
