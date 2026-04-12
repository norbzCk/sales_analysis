import { FormEvent, useState } from "react";
import { AuthScene } from "../components/AuthScene";
import { persistSession } from "../features/auth/authStorage";
import type { SessionUser } from "../types/auth";
import { apiRequest } from "../lib/http";

export function BusinessRegisterPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      business_name: String(form.get("business_name") || "").trim(),
      owner_name: String(form.get("owner_name") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      phone: String(form.get("phone") || "").trim(),
      password: String(form.get("password") || ""),
      business_type: String(form.get("business_type") || "individual"),
      category: String(form.get("category") || "").trim() || null,
      description: String(form.get("description") || "").trim() || null,
      region: String(form.get("region") || "Dar es Salaam"),
      area: String(form.get("area") || "").trim() || null,
      street: String(form.get("street") || "").trim() || null,
      shop_number: String(form.get("shop_number") || "").trim() || null,
      operating_hours: String(form.get("operating_hours") || "").trim() || null,
      shop_logo_url: String(form.get("shop_logo_url") || "").trim() || null,
      shop_images: String(form.get("shop_images") || "").trim() || null,
      role: "seller",
    };

    try {
      const data = await apiRequest<{ token?: string; user?: SessionUser }>("/business/register", {
        method: "POST",
        auth: false,
        body: payload,
      });
      setSuccess("Business registered successfully.");
      if (data.token && data.user) {
        persistSession(data.token, data.user, "business");
      }
      setTimeout(() => {
        window.location.href = "/app/seller";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="Business onboarding"
      title="Open your business storefront on Kariakoo."
      description="Set up your seller profile, organize your product category, and move straight into the business dashboard after registration."
      bullets={[
        "Create a seller-ready account in one step",
        "Show suppliers and buyers who runs the business",
        "Keep the same backend registration contract as the legacy frontend",
      ]}
      links={[
        { to: "/login", label: "Back to sign in" },
        { to: "/register/customer", label: "Join as customer" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Seller account</p>
          <h2>Business registration</h2>
        </div>
      </div>
      <form className="form-grid auth-form-grid auth-form-two-col" onSubmit={handleSubmit}>
        {error ? <p className="alert error">{error}</p> : null}
        {success ? <p className="alert success">{success}</p> : null}
        <label>
          Business name
          <input name="business_name" required />
        </label>
        <label>
          Owner name
          <input name="owner_name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Phone
          <input name="phone" required />
        </label>
        <label>
          Address
          <input name="street" />
        </label>
        <label>
          Business type
          <select name="business_type" defaultValue="individual">
            <option value="individual">Individual trader</option>
            <option value="company">Registered company</option>
          </select>
        </label>
        <label>
          Category
          <input name="category" />
        </label>
        <label>
          Area
          <input name="area" />
        </label>
        <label>
          Region
          <input name="region" defaultValue="Dar es Salaam" />
        </label>
        <label>
          Shop number
          <input name="shop_number" />
        </label>
        <label>
          Description
          <input name="description" />
        </label>
        <label>
          Operating hours
          <input name="operating_hours" placeholder="Mon-Sat 08:00-18:00" />
        </label>
        <label>
          Shop logo URL
          <input name="shop_logo_url" />
        </label>
        <label>
          Shop image URLs
          <input name="shop_images" placeholder="Comma-separated URLs" />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Submitting..." : "Register business"}
        </button>
      </form>
    </AuthScene>
  );
}
