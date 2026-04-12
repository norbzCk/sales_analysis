import { FormEvent, useState } from "react";
import { AuthScene } from "../components/AuthScene";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/http";

export function CustomerRegisterPage() {
  const navigate = useNavigate();
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
      email: String(form.get("email") || "").trim().toLowerCase(),
      phone: String(form.get("phone") || "").trim(),
      password: String(form.get("password") || ""),
    };

    try {
      await apiRequest("/auth/register-customer", {
        method: "POST",
        auth: false,
        body: payload,
      });
      setSuccess("Customer registered successfully.");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="Customer onboarding"
      title="Create your buyer account and start sourcing."
      description="Join the marketplace, compare suppliers, and track orders inside the customer dashboard with the same backend logic as before."
      bullets={[
        "Browse verified products and suppliers",
        "Submit RFQs and place orders faster",
        "Track payments and delivery progress from one account",
      ]}
      links={[
        { to: "/login", label: "Back to sign in" },
        { to: "/register/business", label: "Need a seller account?" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Buyer account</p>
          <h2>Customer registration</h2>
        </div>
      </div>
      <form className="form-grid auth-form-grid" onSubmit={handleSubmit}>
        {error ? <p className="alert error">{error}</p> : null}
        {success ? <p className="alert success">{success}</p> : null}
        <label>
          Full name
          <input name="name" required />
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
          Password
          <input name="password" type="password" required />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Submitting..." : "Register customer"}
        </button>
      </form>
    </AuthScene>
  );
}
