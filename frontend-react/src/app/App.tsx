import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { AppShell } from "../features/layout/AppShell";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { BusinessRegisterPage } from "../pages/BusinessRegisterPage";
import { CustomersPage } from "../pages/CustomersPage";
import { CustomerDashboardPage } from "../pages/CustomerDashboardPage";
import { CustomerRegisterPage } from "../pages/CustomerRegisterPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { HomePage } from "../pages/HomePage";
import { LogisticsDashboardPage } from "../pages/LogisticsDashboardPage";
import { LogisticsRegisterPage } from "../pages/LogisticsRegisterPage";
import { LoginPage } from "../pages/LoginPage";
import { OrdersPage } from "../pages/OrdersPage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ProvidersPage } from "../pages/ProvidersPage";
import { SellerDashboardPage } from "../pages/SellerDashboardPage";
import { SellerDeliveriesPage } from "../pages/SellerDeliveriesPage";
import { SellerProfilePage } from "../pages/SellerProfilePage";
import { SuperadminDashboardPage } from "../pages/SuperadminDashboardPage";
import { SuperadminLoginPage } from "../pages/SuperadminLoginPage";
import { UsersPage } from "../pages/UsersPage";

import { ProductDetailPage } from "../pages/ProductDetailPage";

function AppLanding() {
  const { user } = useAuth();
  const role = String(user?.role || "");
  if (role === "super_admin") return <Navigate to="/app/superadmin" replace />;
  if (role === "user") return <Navigate to="/app/customer" replace />;
  if (role === "logistics") return <Navigate to="/app/logistics" replace />;
  if (role === "seller") return <Navigate to="/app/seller" replace />;
  return <Navigate to="/app/dashboard" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:productId" element={<ProductDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/superadmin" element={<SuperadminLoginPage />} />
      <Route path="/register/business" element={<BusinessRegisterPage />} />
      <Route path="/register/customer" element={<CustomerRegisterPage />} />
      <Route path="/register/logistics" element={<LogisticsRegisterPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppLanding />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="superadmin" element={<SuperadminDashboardPage />} />
        <Route path="seller" element={<SellerDashboardPage />} />
        <Route path="seller/profile" element={<SellerProfilePage />} />
        <Route path="seller/deliveries" element={<SellerDeliveriesPage />} />
        <Route path="customer" element={<CustomerDashboardPage />} />
        <Route path="logistics" element={<LogisticsDashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="product/:productId" element={<ProductDetailPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
