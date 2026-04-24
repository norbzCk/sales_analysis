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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-surface-bg dark:bg-slate-900 flex flex-col items-center justify-center p-6 selection:bg-brand/20">
      <div className="w-full max-w-[480px] space-y-8 animate-soft-enter">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 bg-brand rounded-[22px] shadow-2xl shadow-brand/30">
            <BrandMark subtitle="" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome back</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Please enter your details to sign in.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-premium p-8 md:p-10 border border-slate-100 dark:border-slate-700">
          {error ? (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-2xl font-bold flex items-center gap-3 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Phone or email</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input 
                  name="identifier" 
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                  placeholder="name@email.com" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Password</label>
                <Link to="/forgot-password" className="text-xs font-bold text-brand hover:underline">Forgot password?</Link>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-12 pr-14 py-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-2xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              className="w-full btn-primary !py-4 shadow-brand/30" 
              disabled={isSubmitting} 
              type="submit"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : "Sign in"}
            </button>
          </form>
        </div>

        <div className="flex flex-col items-center space-y-6 pt-4">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Don't have an account? <Link to="/register/customer" className="text-brand hover:underline">Create account</Link>
          </p>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            <Link to="/register/business" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-brand transition-colors">Business</Link>
            <Link to="/register/logistics" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-brand transition-colors">Logistics</Link>
            <Link to="/superadmin" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-brand transition-colors">Admin</Link>
            <Link to="/" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-brand transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
