import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../features/auth/AuthContext";
import { getPostLoginPath } from "../features/auth/authStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // <-- added for eye toggle

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
    <div className="login-page-simple">
      <div className="login-card-simple">
        <BrandMark subtitle="" />

        <div className="auth-card-header login-card-header-simple">
          <div>
            <p className="eyebrow">Account access</p>
            <h1>Sign in</h1>
            <p className="login-card-subtitle">Use your phone number or email to continue.</p>
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
            <div className="password-input-wrapper">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="login-links-simple">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register/customer">Create customer account</Link>
          <Link to="/register/business">Create business account</Link>
          <Link to="/register/logistics">Create logistics account</Link>
          <Link to="/superadmin">Superadmin login</Link>
          <Link to="/">Back to homepage</Link>
        </div>
      </div>
    </div>
  );
}
