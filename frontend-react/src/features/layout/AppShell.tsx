import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "../../components/Sidebar";

/**
 * AppShell provides a consistent layout for all authenticated routes.
 * It includes the new Sidebar (which displays the user's profile photo,
 * navigation links, and a gradient top bar) and renders the nested route
 * content via <Outlet />.
 *
 * The CSS classes `app-shell`, `content`, `top-header`, etc., should be
 * defined in your stylesheet to control the sidebar width, apply a
 * gradient background to the top navigation bar, and style the overall
 * layout.
 */
export function AppShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      {/* Sidebar with profile photo and navigation */}
      <Sidebar />

      {/* Main content area */}
      <main className="content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="header-title">{pageTitle}</h1>
            <p className="header-subtitle">
              Welcome back to your {roleLabel.toLowerCase()} dashboard
            </p>
          </div>
          <div className="header-right">
            <button className="header-logout-button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </header>

        <div className="page-body">
          {/* Render the nested route component */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
