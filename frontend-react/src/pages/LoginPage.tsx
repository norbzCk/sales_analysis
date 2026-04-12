import { FormEvent, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AuthScene } from "../components/AuthScene";
import { useAuth } from "../features/auth/AuthContext";
import { getPostLoginPath } from "../features/auth/authStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("registerEmail") || "").trim().toLowerCase();
    const password = String(form.get("registerPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsSubmitting(false);
      return;
    }

    try {
      await register({ name, email, password });
      setSuccess("Account created. Please sign in.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="Welcome back"
      title="Sign in to your marketplace workspace."
      description="Access your sourcing dashboard, business tools, or delivery workflow with the same backend-powered account system."
      bullets={[
        "Browse products and verified suppliers",
        "Track orders, deliveries, and payment activity",
        "Switch between customer, business, and logistics flows cleanly",
      ]}
      links={[
        { to: "/register/business", label: "Business registration" },
        { to: "/register/customer", label: "Customer registration" },
        { to: "/register/logistics", label: "Logistics registration" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Account access</p>
          <h2>Sign in or create an account</h2>
        </div>
      </div>
      <div className="tab-row">
        <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")} type="button">
          Sign in
        </button>
        <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")} type="button">
          Create account
        </button>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {success ? <p className="alert success">{success}</p> : null}

      {mode === "login" ? (
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
          <div className="inline-link-row">
            <span className="muted">Need a customer account?</span>
            <Link to="/register/customer">Join free</Link>
          </div>
        </form>
      ) : (
        <form className="form-grid auth-form-grid" onSubmit={handleRegister}>
          <label>
            Name
            <input name="name" placeholder="Your full name" required />
          </label>
          <label>
            Email
            <input name="registerEmail" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input name="registerPassword" type="password" placeholder="Create a password" required />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" placeholder="Repeat your password" required />
          </label>
          <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
      )}
    </AuthScene>
  );
}
