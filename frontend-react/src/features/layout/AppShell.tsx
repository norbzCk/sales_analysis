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
  const normalizedSection = isSeller && location.pathname === "/app/seller" ? "Business Overview" : currentSection;

  const navItems = isLogistics
    ? [
        { to: "/app/logistics", label: "Logistics Dashboard" },
        { to: "/app/notifications", label: "Notifications" },
      ]
    : isCustomer
      ? [
          { to: "/app/customer", label: "Dashboard" },
          { to: "/app/products", label: "Shop" },
          { to: "/app/orders", label: "Orders" },
          { to: "/app/payments", label: "Payments" },
          { to: "/app/notifications", label: "Notifications" },
          { to: "/app/profile", label: "Profile" },
        ]
      : isSeller
        ? [
            { to: "/app/seller", label: "Business Overview" },
            { to: "/app/products", label: "Products" },
            { to: "/app/orders", label: "Orders" },
            { to: "/app/seller/deliveries", label: "Deliveries" },
            { to: "/app/notifications", label: "Notifications" },
            { to: "/app/seller/profile", label: "Business Profile" },
          ]
      : [
          { to: "/app/dashboard", label: "Dashboard" },
          { to: "/app/products", label: "Products" },
          { to: "/app/orders", label: "Orders" },
          { to: "/app/notifications", label: "Notifications" },
          { to: "/app/providers", label: "Providers" },
          ...(role === "super_admin" || role === "owner" ? [{ to: "/app/customers", label: "Customers" }, { to: "/app/sales", label: "Sales" }] : []),
          { to: "/app/users", label: "Users" },
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

    // Listen for notifications being marked as read
    function handleNotificationsRead() {
      void loadSummary();
    }
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

  const sidebarTitle = isSeller
    ? "Manage your storefront, sales, and deliveries in one dashboard"
    : "Trade, order, and deliver in one place";
  const sidebarCopy = isSeller
    ? "You can manage product listings, process customer orders, assign deliveries, and track performance from your business workspace."
    : "Sellers manage products and stock, customers compare and order, and delivery teams coordinate fulfillment from the same platform.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <BrandMark subtitle="Marketplace operations hub" />
          <p className="eyebrow">Marketplace workspace</p>
          <h1 className="sidebar-title">{sidebarTitle}</h1>
          <p className="sidebar-copy">{sidebarCopy}</p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span>{item.label}</span>
              {item.to === "/app/notifications" && unreadNotifications > 0 ? (
                <span className="nav-item-badge">{unreadNotifications}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="topbar-breadcrumb">{normalizedSection}</p>
          </div>
          <div className="topbar-actions">
            <Link className="role-chip role-chip-link" to="/app/notifications">
              {unreadNotifications} unread
            </Link>
            <span className="role-chip">{roleLabel}</span>
            <button className="secondary-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
