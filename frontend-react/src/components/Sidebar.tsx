import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { BrandMark } from "./BrandMark";
import { env } from "../config/env";
import { useState, useEffect } from "react";

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

export function Sidebar() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const role = String(user?.role || "");
  const profilePath =
    role === "seller"
      ? "/app/seller/profile"
      : role === "logistics"
        ? "/app/logistics/profile"
        : role === "user"
          ? "/app/customer/profile"
          : role === "super_admin" || role === "owner"
            ? "/app/superadmin/profile"
            : "/app/profile";
  const isSeller = role === "seller";
  const isCustomer = role === "user";
  const isLogistics = role === "logistics";
  const isSuperadmin = role === "super_admin" || role === "owner";
  const isAdmin = role === "admin";
  const settingsPath = isSuperadmin ? "/app/superadmin/settings" : "/app/settings";

  const NavItem = ({ to, children, end = false }: { to: string, children: React.ReactNode, end?: boolean }) => (
    <NavLink 
      to={to} 
      end={end}
      className={({ isActive }) => 
        `relative flex items-center px-4 py-3 rounded-xl font-semibold transition-all duration-200
         text-white/90 hover:bg-white/10 hover:text-white
         ${isActive ? 'bg-white/15 text-white' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative z-10">{children}</span>
          {isActive && (
            <span className="absolute left-0 w-1 h-1/2 bg-accent rounded-full transition-all duration-300" />
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Mobile menu toggle */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-brand text-white md:hidden shadow-lg active:scale-95 transition-transform" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        type="button"
        aria-label="Toggle navigation menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-72
        bg-brand-strong text-white p-6 flex flex-col z-40 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top branding */}
        <header className="mb-10 px-2">
          <BrandMark />
        </header>

        {/* Navigation links */}
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {isSuperadmin && <NavItem to="/app/superadmin" end>Dashboard</NavItem>}
          {isAdmin && <NavItem to="/app/dashboard" end>Dashboard</NavItem>}
          
          {isSeller && (
            <>
              <NavItem to="/app/seller" end>Dashboard</NavItem>
              <NavItem to="/app/products">Products</NavItem>
              <NavItem to="/app/orders">Orders</NavItem>
              <NavItem to="/app/providers">Providers</NavItem>
              <NavItem to="/app/notifications">Notifications</NavItem>
              <NavItem to="/app/seller/deliveries">Deliveries</NavItem>
            </>
          )}

          {isCustomer && (
            <>
              <NavItem to="/app/customer" end>Dashboard</NavItem>
              <NavItem to="/app/products">Products</NavItem>
              <NavItem to="/app/orders">Orders</NavItem>
              <NavItem to="/app/payments">Payments</NavItem>
              <NavItem to="/app/notifications">Notifications</NavItem>
            </>
          )}

          {isLogistics && (
            <>
              <NavItem to="/app/logistics" end>Dashboard</NavItem>
              <NavItem to="/app/notifications">Notifications</NavItem>
            </>
          )}

          {(isAdmin || isSuperadmin) && (
            <>
              {!isSuperadmin && (
                <>
                  <NavItem to="/app/products">Products</NavItem>
                  <NavItem to="/app/orders">Orders</NavItem>
                  <NavItem to="/app/providers">Providers</NavItem>
                  <NavItem to="/app/users">Users</NavItem>
                </>
              )}
              {isSuperadmin && (
                <>
                  <NavItem to="/app/customers">Customers</NavItem>
                  <NavItem to="/app/users">Users</NavItem>
                </>
              )}
              <NavItem to="/app/notifications">Notifications</NavItem>
            </>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto pt-6 flex flex-col gap-1">
          <NavItem to={profilePath}>Profile</NavItem>
          <NavItem to={settingsPath}>Settings</NavItem>
          <button
            type="button"
            className="flex items-center px-4 py-3 rounded-xl font-semibold transition-all duration-200 mt-2 hover:bg-white/10"
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
