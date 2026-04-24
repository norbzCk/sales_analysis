import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAIAssistant } from "../ai/AIAssistantContext";
import { useTheme } from "../../features/auth/ThemeContext";
import { Sidebar } from "../../components/Sidebar";
import { env } from "../../config/env";

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function getInitials(name?: string) {
  const text = String(name || "User").trim();
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function AppShell() {
  const { logout, user } = useAuth();
  const { openAssistant } = useAIAssistant();
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTheme: theme, toggleTheme } = useTheme();

  const role = String(user?.role || "");
  const isSeller = role === "seller";
  const isCustomer = role === "user";
  const isLogistics = role === "logistics";

  const roleLabel =
    role === "seller"
      ? "Seller"
      : role === "user"
        ? "Buyer"
        : role === "logistics"
          ? "Delivery Agent"
          : role === "super_admin"
            ? "Super Admin"
            : role === "owner"
              ? "Owner"
              : "Admin";

  const currentSection = location.pathname
    .replace(/^\/app\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ") || "Dashboard";

  const pageTitle = isSeller
    ? location.pathname === "/app/seller"
      ? "Business Workspace"
      : currentSection
    : isCustomer
      ? location.pathname === "/app/customer"
        ? "Customer Hub"
        : currentSection
      : isLogistics
        ? location.pathname === "/app/logistics"
          ? "Logistics Center"
          : currentSection
        : currentSection;

  const profilePhotoUrl = user?.profile_photo;
  const displayName = user?.name || user?.business_name || user?.owner_name || user?.email || "User";
  const profilePath = role === "seller" ? "/app/seller/profile" 
    : role === "logistics" ? "/app/logistics/profile" 
    : role === "user" ? "/app/customer/profile" 
    : role === "super_admin" ? "/app/superadmin/profile" 
    : "/app/profile";

  return (
    <div className="flex min-h-screen bg-surface-bg dark:bg-slate-900 selection:bg-brand/20">
      {/* Sidebar with profile photo and navigation */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 md:h-20 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 px-4 md:px-8 flex items-center justify-between">
          <div className="flex flex-col ml-12 md:ml-0 overflow-hidden">
            <h1 className="text-base md:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 truncate">
              {pageTitle}
            </h1>
            <p className="hidden sm:block text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Authenticated as <span className="text-brand">{roleLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            <div className="flex items-center gap-1 md:gap-2 md:pr-4 md:border-r md:border-slate-200 dark:md:border-slate-700">
              <button
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-brand/5 dark:bg-brand/10 text-brand hover:bg-brand/10 dark:hover:bg-brand/20 transition-colors rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest min-h-0 min-w-0"
                onClick={openAssistant}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="hidden xs:inline">Ask AI</span>
              </button>
              
              <button 
                className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all rounded-xl min-h-0 min-w-0" 
                onClick={toggleTheme}
              >
                {theme === "light" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
            </div>

            <Link to={profilePath} className="flex items-center gap-2 p-1 pl-3 md:pl-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all rounded-2xl group min-h-0 min-w-0">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-black text-slate-900 dark:text-white leading-none">{displayName.split(' ')[0]}</span>
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{roleLabel}</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-[14px] overflow-hidden border-2 border-white dark:border-slate-600 shadow-md transition-transform group-hover:scale-105">
                {profilePhotoUrl ? (
                  <img src={resolveImageUrl(profilePhotoUrl)} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand flex items-center justify-center text-white font-black text-[10px] md:text-xs">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden p-4 md:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
