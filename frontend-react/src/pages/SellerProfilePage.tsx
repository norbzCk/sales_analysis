import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../lib/http";
import type { BusinessProfile } from "../types/domain";

const initialProfile: BusinessProfile = {
  id: 0,
  business_name: "",
  owner_name: "",
  phone: "",
  email: "",
  business_type: "individual",
  category: "",
  description: "",
  region: "Dar es Salaam",
  area: "",
  street: "",
  shop_number: "",
  operating_hours: "",
  shop_logo_url: "",
  shop_images: "",
  verification_status: "unverified",
};

export function SellerProfilePage() {
  const [profile, setProfile] = useState<BusinessProfile>(initialProfile);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<BusinessProfile>("/business/me");
      setProfile({
        ...initialProfile,
        ...data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load business profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");

    try {
      const payload = {
        business_name: profile.business_name,
        owner_name: profile.owner_name,
        business_type: profile.business_type,
        email: profile.email || null,
        phone: profile.phone,
        category: profile.category || null,
        description: profile.description || null,
        region: profile.region || null,
        area: profile.area || null,
        street: profile.street || null,
        shop_number: profile.shop_number || null,
        operating_hours: profile.operating_hours || null,
        shop_logo_url: profile.shop_logo_url || null,
        shop_images: profile.shop_images || null,
      };
      const response = await apiRequest<{ user?: BusinessProfile; message?: string }>("/business/me", {
        method: "PUT",
        body: payload,
      });
      if (response.user) {
        setProfile((prev) => ({ ...prev, ...response.user }));
      }
      setFlash(response.message || "Business profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  async function requestVerification() {
    setError("");
    setFlash("");
    try {
      await apiRequest("/business/verify", {
        method: "POST",
        body: {
          document_type: "business_profile",
          document_url: profile.shop_logo_url || null,
        },
      });
      setFlash("Verification request submitted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit verification");
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Seller profile</p>
        <h1>Business account and storefront identity</h1>
        <p className="muted">
          Update your shop details, branding, operating hours, and verification status.
        </p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      {loading ? <p className="panel">Loading profile...</p> : null}

      {!loading ? (
        <form className="panel form-grid auth-form-two-col" onSubmit={handleSubmit}>
          <label>Business name<input value={profile.business_name || ""} onChange={(event) => setProfile((prev) => ({ ...prev, business_name: event.target.value }))} required /></label>
          <label>Owner name<input value={profile.owner_name || ""} onChange={(event) => setProfile((prev) => ({ ...prev, owner_name: event.target.value }))} required /></label>
          <label>Phone<input value={profile.phone || ""} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} required /></label>
          <label>Email<input type="email" value={profile.email || ""} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} /></label>
          <label>Business type<input value={profile.business_type || ""} onChange={(event) => setProfile((prev) => ({ ...prev, business_type: event.target.value }))} /></label>
          <label>Category<input value={profile.category || ""} onChange={(event) => setProfile((prev) => ({ ...prev, category: event.target.value }))} /></label>
          <label>Region<input value={profile.region || ""} onChange={(event) => setProfile((prev) => ({ ...prev, region: event.target.value }))} /></label>
          <label>Area<input value={profile.area || ""} onChange={(event) => setProfile((prev) => ({ ...prev, area: event.target.value }))} /></label>
          <label>Street<input value={profile.street || ""} onChange={(event) => setProfile((prev) => ({ ...prev, street: event.target.value }))} /></label>
          <label>Shop number<input value={profile.shop_number || ""} onChange={(event) => setProfile((prev) => ({ ...prev, shop_number: event.target.value }))} /></label>
          <label>Operating hours<input value={profile.operating_hours || ""} onChange={(event) => setProfile((prev) => ({ ...prev, operating_hours: event.target.value }))} placeholder="Mon-Sat 08:00-18:00" /></label>
          <label>Shop logo URL<input value={profile.shop_logo_url || ""} onChange={(event) => setProfile((prev) => ({ ...prev, shop_logo_url: event.target.value }))} /></label>
          <label>Shop images (comma separated URLs)<input value={profile.shop_images || ""} onChange={(event) => setProfile((prev) => ({ ...prev, shop_images: event.target.value }))} /></label>
          <label className="full-width">Business description<textarea value={profile.description || ""} onChange={(event) => setProfile((prev) => ({ ...prev, description: event.target.value }))} /></label>
          <div className="hero-actions">
            <button className="primary-button" type="submit">Save business profile</button>
            <button className="secondary-button" type="button" onClick={requestVerification}>
              Request verification ({profile.verification_status || "unverified"})
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
