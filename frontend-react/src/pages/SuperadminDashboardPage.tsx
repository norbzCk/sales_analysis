import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { SuperadminOverview, VerificationBusinessman, VerificationLogistics } from "../types/domain";

interface Businessman {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  created_at?: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at?: string;
}

interface LogisticsUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  account_type: string;
  created_at?: string;
}

type ActiveTab = "businessmen" | "customers" | "logistics";

function money(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

export function SuperadminDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<SuperadminOverview | null>(null);
  const [businessmen, setBusinessmen] = useState<Businessman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logistics, setLogistics] = useState<LogisticsUser[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("businessmen");
  const [showAddModal, setShowAddModal] = useState(false);
  const [verificationTab, setVerificationTab] = useState<"businessmen" | "logistics">("businessmen");
  const [verificationData, setVerificationData] = useState<{
    businessmen: VerificationBusinessman[];
    logistics: VerificationLogistics[];
  }>({ businessmen: [], logistics: [] });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [overviewData, businessmenData, customersData, logisticsData] = await Promise.all([
        apiRequest<SuperadminOverview>("/superadmin/stats"),
        apiRequest<Businessman[]>("/superadmin/businessmen"),
        apiRequest<Customer[]>("/superadmin/customers"),
        apiRequest<LogisticsUser[]>("/superadmin/logistics"),
      ]);
      const verifications = await apiRequest<{
        businessmen: VerificationBusinessman[];
        logistics: VerificationLogistics[];
      }>("/superadmin/verifications");
      setOverview(overviewData);
      setBusinessmen(businessmenData);
      setCustomers(customersData);
      setLogistics(logisticsData);
      setVerificationData(verifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load superadmin overview");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBusinessman(id: number) {
    if (!confirm("Are you sure you want to delete this seller account?")) return;
    try {
      await apiRequest(`/superadmin/businessmen/${id}`, { method: "DELETE" });
      setSuccess("Seller deleted successfully");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete seller");
    }
  }

  async function handleDeleteCustomer(id: number) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await apiRequest(`/superadmin/customers/${id}`, { method: "DELETE" });
      setSuccess("Customer deleted successfully");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete customer");
    }
  }

  async function handleDeleteLogistics(id: number) {
    if (!confirm("Are you sure you want to delete this logistics user?")) return;
    try {
      await apiRequest(`/superadmin/logistics/${id}`, { method: "DELETE" });
      setSuccess("Logistics user deleted successfully");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete logistics user");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function updateVerification(kind: "businessmen" | "logistics", id: number, status: string) {
    try {
      await apiRequest(`/superadmin/${kind}/${id}/verification`, {
        method: "PATCH",
        body: { status },
      });
      setSuccess(`${kind === "businessmen" ? "Seller" : "Logistics"} verification updated.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update verification");
    }
  }

  const currentData = activeTab === "businessmen" ? businessmen : activeTab === "customers" ? customers : logistics;
  const cards = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Marketplace revenue", value: money(overview.total_revenue), note: `${overview.completed_orders} completed orders` },
      { label: "Average order value", value: money(overview.average_order_value), note: "Platform-wide buyer spend" },
      { label: "Active sellers", value: String(overview.active_businessmen), note: `${overview.total_businessmen} registered` },
      { label: "Orders in transit", value: String(overview.in_transit_orders), note: `${overview.pending_orders} still open` },
      { label: "Low-stock products", value: String(overview.low_stock_products), note: "Requires seller attention" },
      { label: "Active logistics", value: String(overview.active_logistics), note: `${overview.total_logistics} delivery accounts` },
    ];
  }, [overview]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Superadmin command center</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketplace business overview</h1>
              <p className="text-gray-600">This view tracks seller performance, platform demand, inventory risk, and delivery load across the whole system.</p>
            </div>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
          {overview?.insights?.length ? (
            <div className="flex flex-wrap gap-2">
              {overview.insights.map((insight) => (
                <span key={insight.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{insight.title}</span>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div> : null}
        {success ? <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">{success}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <span className="text-sm font-medium text-gray-500 block mb-2">{card.label}</span>
              <strong className="text-2xl font-bold text-gray-900 block mb-1">{loading ? "..." : card.value}</strong>
              <p className="text-gray-600 text-sm">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <span className="text-sm font-medium text-gray-500 block mb-2">Seller verifications</span>
            <strong className="text-2xl font-bold text-gray-900 block mb-1">{loading ? "..." : overview?.pending_business_verifications || 0}</strong>
            <p className="text-gray-600 text-sm">Pending approval</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <span className="text-sm font-medium text-gray-500 block mb-2">Logistics verifications</span>
            <strong className="text-2xl font-bold text-gray-900 block mb-1">{loading ? "..." : overview?.pending_logistics_verifications || 0}</strong>
            <p className="text-gray-600 text-sm">Pending approval</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Seller leaderboard</p>
              <h2 className="text-xl font-bold text-gray-900">Best-performing businesses</h2>
            </div>
            <div className="space-y-4">
              {!overview?.seller_leaderboard?.length ? <p className="text-gray-600">No seller performance data yet.</p> : null}
              {overview?.seller_leaderboard?.map((seller) => (
                <div key={seller.id} className="flex justify-between items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div>
                    <strong className="text-gray-900">{seller.business_name}</strong>
                    <p className="text-gray-600 text-sm">{seller.area || seller.region || "Marketplace"} · {seller.total_sales} sales · {money(seller.total_revenue)}</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium mb-2 inline-block">{seller.rating.toFixed(1)} rating</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {seller.badges?.map((badge) => (
                        <span key={badge.id} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">{badge.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Category demand</p>
              <h2 className="text-xl font-bold text-gray-900">Revenue by marketplace category</h2>
            </div>
            <div className="space-y-4">
              {!overview?.category_performance?.length ? <p className="text-gray-600">No category analytics available.</p> : null}
              {overview?.category_performance?.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-gray-900 font-medium">{item.category}</span>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${Math.max(12, (item.revenue / Math.max(...(overview.category_performance || []).map((entry) => entry.revenue), 1)) * 100)}%` }} />
                    </div>
                  </div>
                <strong className="revenue-amount">{compactMoney(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Verification center</p>
              <h2 className="text-xl font-bold text-gray-900">Approve businesses and delivery agents</h2>
            </div>
            <div className="flex border-b border-gray-200 mb-4">
              <button 
                className={`px-4 py-2 text-sm font-medium ${verificationTab === "businessmen" ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700"}`} 
                type="button" 
                onClick={() => setVerificationTab("businessmen")}
              >
                Sellers ({verificationData.businessmen.filter((item) => item.verification_status === "pending").length} pending)
              </button>
              <button 
                className={`px-4 py-2 text-sm font-medium ${verificationTab === "logistics" ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700"}`} 
                type="button" 
                onClick={() => setVerificationTab("logistics")}
              >
                Logistics ({verificationData.logistics.filter((item) => item.verification_status === "pending").length} pending)
              </button>
            </div>
            <div className="space-y-4">
              {verificationTab === "businessmen" && !verificationData.businessmen.length ? <p className="text-gray-600">No seller verification records.</p> : null}
              {verificationTab === "businessmen" && verificationData.businessmen.slice(0, 6).map((item) => (
                <div key={item.id} className="flex justify-between items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div>
                    <strong className="text-gray-900">{item.business_name}</strong>
                    <p className="text-gray-600 text-sm">{item.owner_name} · {item.area || item.region || "Marketplace"} · {item.category || "General"}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-sm font-medium mb-2 inline-block ${
                      item.verification_status === "verified" ? "bg-green-100 text-green-800" : 
                      item.verification_status === "pending" ? "bg-yellow-100 text-yellow-800" : 
                      "bg-red-100 text-red-800"
                    }`}>
                      {item.verification_status}
                    </span>
                    <div className="flex gap-2 mt-1">
                      <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm font-medium transition-colors" type="button" onClick={() => void updateVerification("businessmen", item.id, "verified")}>Verify</button>
                      <button className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors" type="button" onClick={() => void updateVerification("businessmen", item.id, "rejected")}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
              {verificationTab === "logistics" && !verificationData.logistics.length ? <p className="text-gray-600">No logistics verification records.</p> : null}
              {verificationTab === "logistics" && verificationData.logistics.slice(0, 6).map((item) => (
                <div key={item.id} className="flex justify-between items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div>
                    <strong className="text-gray-900">{item.name}</strong>
                    <p className="text-gray-600 text-sm">{item.vehicle_type || "Vehicle pending"} · {item.base_area || "Coverage not set"}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-sm font-medium mb-2 inline-block ${
                      item.verification_status === "verified" ? "bg-green-100 text-green-800" : 
                      item.verification_status === "pending" ? "bg-yellow-100 text-yellow-800" : 
                      "bg-red-100 text-red-800"
                    }`}>
                      {item.verification_status}
                    </span>
                    <div className="flex gap-2 mt-1">
                      <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm font-medium transition-colors" type="button" onClick={() => void updateVerification("logistics", item.id, "verified")}>Verify</button>
                      <button className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors" type="button" onClick={() => void updateVerification("logistics", item.id, "rejected")}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Inventory watchlist</p>
              <h2 className="text-xl font-bold text-gray-900">Products nearing stock-out</h2>
            </div>
            <div className="space-y-4">
              {!overview?.inventory_watch?.length ? <p className="text-gray-600">Inventory pressure is currently low.</p> : null}
              {overview?.inventory_watch?.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <strong className="text-gray-900">{item.product_name}</strong>
                    <p className="text-gray-600 text-sm">{item.seller_name} · {item.seller_area || "Marketplace"}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">{item.stock} left</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent business activity</p>
            <h2 className="text-xl font-bold text-gray-900">Latest marketplace orders</h2>
          </div>
          <div className="space-y-4">
            {!overview?.recent_orders?.length ? <p className="text-gray-600">No recent activity yet.</p> : null}
            {overview?.recent_orders?.map((order) => (
              <div key={order.id} className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div>
                  <strong className="text-gray-900">#{order.id} {order.product || "Order"}</strong>
                  <p className="text-gray-600 text-sm">{order.provider_name || "Marketplace seller"} · {order.date || "No date"}</p>
                </div>
                <div className="text-right">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium mb-1 inline-block">{order.status || "Pending"}</span>
                  <div className="text-lg font-bold text-teal-600">{money(order.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex border-b border-gray-200 mb-4">
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "businessmen" ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700"}`} 
              onClick={() => setActiveTab("businessmen")} 
              type="button"
            >
              Sellers ({businessmen.length})
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "customers" ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700"}`} 
              onClick={() => setActiveTab("customers")} 
              type="button"
            >
              Customers ({customers.length})
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "logistics" ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700"}`} 
              onClick={() => setActiveTab("logistics")} 
              type="button"
            >
              Logistics ({logistics.length})
            </button>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{activeTab === "businessmen" ? "Seller accounts" : activeTab === "customers" ? "Customer accounts" : "Logistics accounts"}</h2>
            <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium transition-colors" onClick={() => setShowAddModal(true)} type="button">
              Add New
            </button>
          </div>
          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : currentData.length === 0 ? (
            <p className="text-gray-600">No records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTab === "businessmen" && businessmen.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.business_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.email || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.phone || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.owner_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors" onClick={() => void handleDeleteBusinessman(item.id)} type="button">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {activeTab === "customers" && customers.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.email || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.phone || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Buyer</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors" onClick={() => void handleDeleteCustomer(item.id)} type="button">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {activeTab === "logistics" && logistics.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.email || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.phone || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.account_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors" onClick={() => void handleDeleteLogistics(item.id)} type="button">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {showAddModal ? (
        <AddEntityModal
          activeTab={activeTab}
          onClose={() => setShowAddModal(false)}
            onCreated={async () => {
              setShowAddModal(false);
              setSuccess("Account created successfully");
              await loadData();
            }}
          onError={(message) => setError(message)}
        />
      ) : null}
        </div>
      </div>
    </div>
  );
}

function AddEntityModal({
  activeTab,
  onClose,
  onCreated,
  onError,
}: {
  activeTab: ActiveTab;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    onError("");
    const form = new FormData(event.currentTarget);

    try {
      if (activeTab === "businessmen") {
        await apiRequest("/superadmin/businessmen", {
          method: "POST",
          body: {
            business_name: String(form.get("business_name") || ""),
            owner_name: String(form.get("owner_name") || ""),
            email: String(form.get("email") || ""),
            phone: String(form.get("phone") || ""),
            password: String(form.get("password") || ""),
            region: String(form.get("region") || "Dar es Salaam"),
            area: String(form.get("area") || ""),
            category: String(form.get("category") || ""),
          },
        });
      } else if (activeTab === "customers") {
        await apiRequest("/superadmin/customers", {
          method: "POST",
          body: {
            name: String(form.get("name") || ""),
            email: String(form.get("email") || ""),
            phone: String(form.get("phone") || ""),
            password: String(form.get("password") || ""),
          },
        });
      } else {
        await apiRequest("/superadmin/logistics", {
          method: "POST",
          body: {
            name: String(form.get("name") || ""),
            email: String(form.get("email") || ""),
            phone: String(form.get("phone") || ""),
            password: String(form.get("password") || ""),
            account_type: String(form.get("account_type") || "individual"),
            vehicle_type: String(form.get("vehicle_type") || ""),
            base_area: String(form.get("base_area") || ""),
          },
        });
      }
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add {activeTab === "businessmen" ? "seller" : activeTab === "customers" ? "customer" : "logistics user"}</h2>
        </div>
        <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
          {activeTab === "businessmen" ? (
            <>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                <input name="business_name" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner name</label>
                <input name="owner_name" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="email" type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input name="phone" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input name="password" type="password" required minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input name="category" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <input name="region" defaultValue="Dar es Salaam" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input name="area" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
            </>
          ) : null}

          {activeTab === "customers" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input name="name" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="email" type="email" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input name="phone" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input name="password" type="password" required minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
            </>
          ) : null}

          {activeTab === "logistics" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input name="name" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="email" type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input name="phone" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input name="password" type="password" required minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account type</label>
                <select name="account_type" defaultValue="individual" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle type</label>
                <input name="vehicle_type" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Base area</label>
                <input name="base_area" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
            </>
          ) : null}

          <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors" type="button" onClick={onClose}>Cancel</button>
            <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
