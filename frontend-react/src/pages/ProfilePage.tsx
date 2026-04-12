import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
    });
  }, [user]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await apiRequest<{ name: string; email: string; phone?: string; address?: string }>("/auth/me", {
        method: "PUT",
        body: {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
        },
      });
      setProfile({
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        address: updated.address || "",
      });
      await refreshUser();
      setFlash("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current_password = String(form.get("current_password") || "");
    const new_password = String(form.get("new_password") || "");
    const confirm_password = String(form.get("confirm_password") || "");
    if (new_password !== confirm_password) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: { current_password, new_password },
      });
      event.currentTarget.reset();
      setFlash("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  if (user?.role !== "user") {
    return <section className="panel"><h1>Profile</h1><p className="muted">The legacy profile screen is only available for customer accounts.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Profile</p><h1>Your account</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <form className="panel form-grid" onSubmit={handleProfileSubmit}>
        <label>Name<input value={profile.name} onChange={(event) => setProfile((state) => ({ ...state, name: event.target.value }))} required /></label>
        <label>Email<input value={profile.email} readOnly /></label>
        <label>Phone<input value={profile.phone} onChange={(event) => setProfile((state) => ({ ...state, phone: event.target.value }))} /></label>
        <label>Address<input value={profile.address} onChange={(event) => setProfile((state) => ({ ...state, address: event.target.value }))} /></label>
        <button className="primary-button" type="submit">Update profile</button>
      </form>
      <form className="panel form-grid" onSubmit={handlePasswordSubmit}>
        <h2>Change password</h2>
        <label>Current password<input name="current_password" type="password" required /></label>
        <label>New password<input name="new_password" type="password" minLength={8} required /></label>
        <label>Confirm new password<input name="confirm_password" type="password" minLength={8} required /></label>
        <button className="primary-button" type="submit">Change password</button>
      </form>
    </section>
  );
}
