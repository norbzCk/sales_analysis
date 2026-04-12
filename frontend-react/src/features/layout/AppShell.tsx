import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { useAuth } from "../auth/AuthContext";

export function AppShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.business_name || user?.name || user?.owner_name || user?.phone || "User";
  const role = String(user?.role || "");
  const isSeller = role === "seller";
  const isCustomer = role === "user";
  const isLogistics = role === "logistics";

  const navItems = isLogistics
    ? [{ to: "/app/logistics", label: "Logistics Dashboard" }]
    : isCustomer
      ? [
          { to: "/app/customer", label: "Dashboard" },
          { to: "/app/products", label: "Products" },
          { to: "/app/orders", label: "Orders" },
          { to: "/app/payments", label: "Payments" },
          { to: "/app/profile", label: "Profile" },
        ]
      : isSeller
        ? [
            { to: "/app/seller", label: "Seller Dashboard" },
            { to: "/app/products", label: "Products" },
            { to: "/app/orders", label: "Orders" },
            { to: "/app/seller/deliveries", label: "Deliveries" },
            { to: "/app/seller/profile", label: "Business Profile" },
          ]
      : [
          { to: "/app/dashboard", label: "Dashboard" },
          { to: "/app/products", label: "Products" },
          { to: "/app/orders", label: "Orders" },
          { to: "/app/providers", label: "Providers" },
          ...(role === "super_admin" || role === "owner" ? [{ to: "/app/customers", label: "Customers" }, { to: "/app/sales", label: "Sales" }] : []),
          { to: "/app/users", label: "Users" },
        ];

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
          <BrandMark subtitle="Kariakoo Digital Marketplace" />
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
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Signed in as</p>
            <h2>{displayName}</h2>
          </div>
          <button className="secondary-button" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
