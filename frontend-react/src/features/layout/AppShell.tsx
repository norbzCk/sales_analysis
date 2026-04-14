import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { apiRequest } from "../../lib/http";
import { useAuth } from "../auth/AuthContext";

export function AppShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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
    ? (location.pathname === "/app/seller" ? "Business Workspace" : currentSection)
    : isCustomer 
      ? (location.pathname === "/app/customer" ? "Customer Hub" : currentSection)
      : isLogistics
        ? (location.pathname === "/app/logistics" ? "Logistics Center" : currentSection)
        : currentSection;

  const navItems = isLogistics
    ? [
        { to: "/app/logistics", label: "Dashboard" },
        { to: "/app/notifications", label: "Notifications" },
      ]
    : isCustomer
      ? [
          { to: "/app/customer", label: "Dashboard" },
          { to: "/app/products", label: "Marketplace" },
          { to: "/app/orders", label: "My Orders" },
          { to: "/app/payments", label: "Payments" },
          { to: "/app/notifications", label: "Notifications" },
          { to: "/app/profile", label: "Settings" },
        ]
      : isSeller
        ? [
            { to: "/app/seller", label: "Overview" },
            { to: "/app/products", label: "Inventory" },
            { to: "/app/orders", label: "Sales Orders" },
            { to: "/app/seller/deliveries", label: "Shipments" },
            { to: "/app/notifications", label: "Notifications" },
            { to: "/app/seller/profile", label: "Storefront" },
          ]
      : [
          { to: "/app/dashboard", label: "Admin Panel" },
          { to: "/app/products", label: "Catalog" },
          { to: "/app/orders", label: "All Orders" },
          { to: "/app/notifications", label: "Notifications" },
          { to: "/app/providers", label: "Vendors" },
          ...(role === "super_admin" || role === "owner" ? [{ to: "/app/customers", label: "Clients" }] : []),
          { to: "/app/users", label: "Account Access" },
        ];

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      if (!user) return;
      try {
        const data = await apiRequest<{ unread_count: number }>("/notifications/summary");
        if (active) {
          setUnreadNotifications(Number(data.unread_count || 0));
        }
      } catch {
        if (active) setUnreadNotifications(0);
      }
    }
    void loadSummary();

    const handleNotificationsRead = () => void loadSummary();
    window.addEventListener('notifications-read', handleNotificationsRead);

    return () => {
      active = false;
      window.removeEventListener('notifications-read', handleNotificationsRead);
    };
  }, [location.pathname, user]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <BrandMark />
          <nav className="nav-list">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to.split('/').length <= 3}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                <span>{item.label}</span>
                {item.to.includes("notifications") && unreadNotifications > 0 ? (
                  <span className="nav-item-badge">{unreadNotifications}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{(user?.name || "U")[0].toUpperCase()}</div>
            <div className="user-details">
              <p className="user-name">{user?.name || "User"}</p>
              <p className="user-role-label">{roleLabel}</p>
            </div>
          </div>
          <div className="sidebar-actions">
            <button className="sidebar-logout" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="header-title">{pageTitle}</h1>
            <p className="header-subtitle">Welcome back to your {roleLabel.toLowerCase()} dashboard</p>
          </div>
          <div className="header-right">
             <Link to="/app/notifications" className="header-icon-btn">
                <span className="icon">🔔</span>
                {unreadNotifications > 0 && <span className="unread-dot">{unreadNotifications}</span>}
             </Link>
          </div>
        </header>

        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
