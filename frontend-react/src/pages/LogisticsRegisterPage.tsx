import { FormEvent, useState } from "react";
import { AuthScene } from "../components/AuthScene";
import { persistSession } from "../features/auth/authStorage";
import type { SessionUser } from "../types/auth";
import { apiRequest } from "../lib/http";

export function LogisticsRegisterPage() {
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
      name: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      password: String(form.get("password") || ""),
      account_type: String(form.get("account_type") || "individual"),
      vehicle_type: String(form.get("vehicle_type") || "").trim(),
      plate_number: String(form.get("plate_number") || "").trim(),
      license_number: String(form.get("license_number") || "").trim(),
      base_area: String(form.get("base_area") || "").trim(),
      coverage_areas: String(form.get("coverage_areas") || "").trim(),
    };

    try {
      const data = await apiRequest<{ token?: string; user?: SessionUser }>("/logistics/register", {
        method: "POST",
        auth: false,
        body: payload,
      });
      if (data.token && data.user) {
        persistSession(data.token, { ...data.user, role: "logistics" }, "logistics");
      }
      setSuccess("Logistics account registered successfully.");
      setTimeout(() => {
        window.location.href = "/app/logistics";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="Logistics onboarding"
      title="Join the delivery network for Kariakoo orders."
      description="Register a rider or delivery company profile, manage availability, and move through delivery statuses from a dedicated dashboard."
      bullets={[
        "Go online and manage availability in real time",
        "Track assigned deliveries and update statuses",
        "Use the same logistics API contract as the legacy app",
      ]}
      links={[
        { to: "/login", label: "Back to sign in" },
        { to: "/register/business", label: "Open a seller account" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Delivery partner</p>
          <h2>Logistics registration</h2>
        </div>
      </div>
      <form className="form-grid auth-form-grid auth-form-two-col" onSubmit={handleSubmit}>
        {error ? <p className="alert error">{error}</p> : null}
        {success ? <p className="alert success">{success}</p> : null}
        <label>
          Full name
          <input name="name" required />
        </label>
        <label>
          Phone
          <input name="phone" required />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>
        <label>
          Account type
          <select name="account_type" defaultValue="individual">
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
        </label>
        <label>
          Vehicle type
          <input name="vehicle_type" required />
        </label>
        <label>
          Plate number
          <input name="plate_number" />
        </label>
        <label>
          License number
          <input name="license_number" />
        </label>
        <label>
          Base area
          <input name="base_area" />
        </label>
        <label>
          Coverage areas
          <input name="coverage_areas" />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Submitting..." : "Register logistics"}
        </button>
      </form>
    </AuthScene>
  );
}
