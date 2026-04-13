import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthScene } from "../components/AuthScene";
import { useAuth } from "../features/auth/AuthContext";
import { getPostLoginPath } from "../features/auth/authStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const user = await login(identifier, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || getPostLoginPath(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="Welcome back"
      title="Sign in to your marketplace workspace."
      description="Access buyer, seller, delivery, or admin workflows through the same backend-powered account system."
      bullets={[
        "Browse products and verified suppliers",
        "Track orders, deliveries, and payment activity",
        "Switch between buyer, seller, delivery, and admin flows cleanly",
      ]}
      links={[
        { to: "/register/customer", label: "Register as Customer" },
        { to: "/register/business", label: "Register as Business" },
        { to: "/register/logistics", label: "Register as Logistics" },
        { to: "/superadmin", label: "Superadmin Login" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Account access</p>
          <h2>Sign in</h2>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <form className="form-grid auth-form-grid" onSubmit={handleLogin}>
        <label>
          Phone or email
          <input name="identifier" placeholder="0700 000 000 or name@email.com" required />
        </label>
        <label>
          Password
          <input name="password" type="password" placeholder="Enter your password" required />
        </label>
        <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="auth-helper-text">
        Forgot your password? <Link to="/forgot-password">Reset it here</Link>.
      </p>
    </AuthScene>
  );
}
