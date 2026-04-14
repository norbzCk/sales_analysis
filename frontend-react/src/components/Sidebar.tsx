import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { BrandMark } from "./BrandMark";
import { env } from "../config/env";

/**
 * Helper to resolve a possibly relative image URL.
 */
function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

/**
 * Returns the initials of a name (e.g. "John Doe" => "JD").
 */
function getInitials(name?: string) {
  const text = String(name || "User").trim();
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

/**
 * Sidebar component displayed on every authenticated page.
 * Shows the user's profile photo (or initials) and navigation links.
 * The width can be styled via the `sidebar` CSS class.
 */
export function Sidebar() {
  const { user, logout } = useAuth();

  // Determine a display name for the avatar placeholder
  const displayName =
    user?.name ||
    user?.business_name ||
    user?.owner_name ||
    user?.email ||
    "User";

  const profilePhotoUrl = user?.profile_photo;

  // Build role‑specific profile link
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

  return (
    <aside className="sidebar">
      {/* Top branding */}
      <header className="sidebar-header">
        <BrandMark />
      </header>

      {/* User avatar / initials */}
      <section className="sidebar-profile">
        {profilePhotoUrl ? (
          <img
            src={resolveImageUrl(profilePhotoUrl)}
            alt={displayName}
            className="sidebar-avatar"
          />
        ) : (
          <div className="sidebar-avatar placeholder">
            {getInitials(displayName)}
          </div>
        )}
        <h3 className="sidebar-username">{displayName}</h3>
        <p className="sidebar-role">{user?.role?.replace("_", " ") || "User"}</p>
      </section>

      {/* Navigation links */}
      <nav className="sidebar-nav">
        <NavLink to="/app/dashboard" className="nav-link">
          Dashboard
        </NavLink>
        <NavLink to="/app/products" className="nav-link">
          Products
        </NavLink>
        <NavLink to="/app/orders" className="nav-link">
          Orders
        </NavLink>
        <NavLink to="/app/payments" className="nav-link">
          Payments
        </NavLink>
        <NavLink to="/app/notifications" className="nav-link">
          Notifications
        </NavLink>
        <NavLink to={profilePath} className="nav-link">
          Profile
        </NavLink>
        {/* Role‑specific pages */}
        {role === "seller" && (
          <NavLink to="/app/seller/deliveries" className="nav-link">
            Deliveries
          </NavLink>
        )}
        {role === "logistics" && (
          <NavLink to="/app/logistics/deliveries" className="nav-link">
            Deliveries
          </NavLink>
        )}
        {role === "super_admin" && (
          <NavLink to="/app/superadmin" className="nav-link">
            Admin Dashboard
          </NavLink>
        )}
        <button
          type="button"
          className="nav-link logout-button"
          onClick={() => {
            logout();
            // After logout, the AuthProvider will clear the session;
            // navigation is handled by the router (e.g., redirect to /login)
          }}
        >
          Sign Out
        </button>
      </nav>
    </aside>
  );
}
