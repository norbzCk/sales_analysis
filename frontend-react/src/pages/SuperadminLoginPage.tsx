import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthScene } from "../components/AuthScene";
import { useAuth } from "../features/auth/AuthContext";

export function SuperadminLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    try {
      await login(email, password);
      navigate("/app/superadmin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScene
      eyebrow="System Administration"
      title="Superadmin Access"
      description="Secure access for system administrators with full platform control."
      bullets={[
        "Manage all users and businesses",
        "View platform analytics and reports",
        "Full system configuration access",
      ]}
      links={[
        { to: "/login", label: "Regular login" },
      ]}
    >
      <div className="auth-card-header">
        <div>
          <p className="eyebrow">Administrator</p>
          <h2>Superadmin Login</h2>
        </div>
      </div>
      <form className="form-grid auth-form-grid" onSubmit={handleLogin}>
        {error ? <p className="alert error">{error}</p> : null}
        <label>
          Email
          <input
            name="email"
            type="email"
            placeholder="superadmin@gmail.com"
            required
            defaultValue="superadmin@gmail.com"
          />
        </label>
        <label>
          Password
          <input name="password" type="password" placeholder="Enter admin key" required />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Authenticating..." : "Sign in as Superadmin"}
        </button>
      </form>
    </AuthScene>
  );
}
