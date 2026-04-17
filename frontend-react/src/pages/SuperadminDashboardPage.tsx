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
    <section className="panel-stack">
      <div className="panel admin-hero">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Superadmin command center</p>
            <h1>Marketplace business overview</h1>
            <p className="muted">This view tracks seller performance, platform demand, inventory risk, and delivery load across the whole system.</p>
          </div>
          <button className="secondary-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
        {overview?.insights?.length ? (
          <div className="buyer-pill-row">
            {overview.insights.map((insight) => (
              <span key={insight.id} className="buyer-pill">{insight.title}</span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {success ? <p className="alert success">{success}</p> : null}

      <div className="stat-grid">
      {cards.map((card) => (
          <article key={card.label} className="stat-card metric-premium">
            <span className="stat-label">{card.label}</span>
            <strong>{loading ? "..." : card.value}</strong>
            <p className="muted">{card.note}</p>
          </article>
      ))}
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-label">Seller verifications</span>
          <strong>{loading ? "..." : overview?.pending_business_verifications || 0}</strong>
          <p className="muted">Pending approval</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Logistics verifications</span>
          <strong>{loading ? "..." : overview?.pending_logistics_verifications || 0}</strong>
          <p className="muted">Pending approval</p>
        </article>
      </div>

      <div className="buyer-section-grid buyer-section-grid--wide">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Seller leaderboard</p>
              <h2>Best-performing businesses</h2>
            </div>
          </div>
          <div className="stack-list">
            {!overview?.seller_leaderboard?.length ? <p className="muted">No seller performance data yet.</p> : null}
            {overview?.seller_leaderboard?.map((seller) => (
              <div key={seller.id} className="list-card inventory-alert">
                <div className="alert-details">
                  <strong>{seller.business_name}</strong>
                  <p className="muted">{seller.area || seller.region || "Marketplace"} · {seller.total_sales} sales · {money(seller.total_revenue)}</p>
                </div>
                <div className="stack-list">
                  <span className="buyer-badge">{seller.rating.toFixed(1)} rating</span>
                  <div className="buyer-pill-row">
                    {seller.badges?.map((badge) => (
                      <span key={badge.id} className="buyer-badge buyer-badge--good">{badge.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Category demand</p>
              <h2>Revenue by marketplace category</h2>
            </div>
          </div>
          <div className="stack-list">
            {!overview?.category_performance?.length ? <p className="muted">No category analytics available.</p> : null}
            {overview?.category_performance?.map((item) => (
              <div key={item.category} className="bar-row seller-bar-row">
                <span className="product-name">{item.category}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(12, (item.revenue / Math.max(...(overview.category_performance || []).map((entry) => entry.revenue), 1)) * 100)}%` }} />
                </div>
                <strong className="revenue-amount">{compactMoney(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="buyer-section-grid">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Verification center</p>
              <h2>Approve businesses and delivery agents</h2>
            </div>
          </div>
          <div className="tab-row">
            <button className={verificationTab === "businessmen" ? "tab active" : "tab"} type="button" onClick={() => setVerificationTab("businessmen")}>
              Sellers ({verificationData.businessmen.filter((item) => item.verification_status === "pending").length} pending)
            </button>
            <button className={verificationTab === "logistics" ? "tab active" : "tab"} type="button" onClick={() => setVerificationTab("logistics")}>
              Logistics ({verificationData.logistics.filter((item) => item.verification_status === "pending").length} pending)
            </button>
          </div>
          <div className="stack-list">
            {verificationTab === "businessmen" && !verificationData.businessmen.length ? <p className="muted">No seller verification records.</p> : null}
            {verificationTab === "businessmen" && verificationData.businessmen.slice(0, 6).map((item) => (
              <div key={item.id} className="list-card inventory-alert">
                <div className="alert-details">
                  <strong>{item.business_name}</strong>
                  <p className="muted">{item.owner_name} · {item.area || item.region || "Marketplace"} · {item.category || "General"}</p>
                </div>
                <div className="stack-list">
                  <span className={`buyer-badge${item.verification_status === "verified" ? " buyer-badge--good" : item.verification_status === "pending" ? " buyer-badge--warn" : " buyer-badge--danger"}`}>
                    {item.verification_status}
                  </span>
                  <div className="hero-actions">
                    <button className="secondary-button" type="button" onClick={() => void updateVerification("businessmen", item.id, "verified")}>Verify</button>
                    <button className="secondary-button" type="button" onClick={() => void updateVerification("businessmen", item.id, "rejected")}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
            {verificationTab === "logistics" && !verificationData.logistics.length ? <p className="muted">No logistics verification records.</p> : null}
            {verificationTab === "logistics" && verificationData.logistics.slice(0, 6).map((item) => (
              <div key={item.id} className="list-card inventory-alert">
                <div className="alert-details">
                  <strong>{item.name}</strong>
                  <p className="muted">{item.vehicle_type || "Vehicle pending"} · {item.base_area || "Coverage not set"}</p>
                </div>
                <div className="stack-list">
                  <span className={`buyer-badge${item.verification_status === "verified" ? " buyer-badge--good" : item.verification_status === "pending" ? " buyer-badge--warn" : " buyer-badge--danger"}`}>
                    {item.verification_status}
                  </span>
                  <div className="hero-actions">
                    <button className="secondary-button" type="button" onClick={() => void updateVerification("logistics", item.id, "verified")}>Verify</button>
                    <button className="secondary-button" type="button" onClick={() => void updateVerification("logistics", item.id, "rejected")}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Inventory watchlist</p>
              <h2>Products nearing stock-out</h2>
            </div>
          </div>
          <div className="stack-list">
            {!overview?.inventory_watch?.length ? <p className="muted">Inventory pressure is currently low.</p> : null}
            {overview?.inventory_watch?.map((item) => (
              <div key={item.product_id} className="list-card inventory-alert">
                <div className="alert-details">
                  <strong>{item.product_name}</strong>
                  <p className="muted">{item.seller_name} · {item.seller_area || "Marketplace"}</p>
                </div>
                <span className="buyer-badge buyer-badge--warn">{item.stock} left</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Recent business activity</p>
              <h2>Latest marketplace orders</h2>
            </div>
          </div>
          <div className="stack-list">
            {!overview?.recent_orders?.length ? <p className="muted">No recent activity yet.</p> : null}
            {overview?.recent_orders?.map((order) => (
              <div key={order.id} className="list-card inventory-alert">
                <div className="alert-details">
                  <strong>#{order.id} {order.product || "Order"}</strong>
                  <p className="muted">{order.provider_name || "Marketplace seller"} · {order.date || "No date"}</p>
                </div>
                <div className="stack-list">
                  <span className="buyer-badge">{order.status || "Pending"}</span>
                  <strong>{money(order.revenue)}</strong>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="panel">
        <div className="tab-row">
          <button className={activeTab === "businessmen" ? "tab active" : "tab"} onClick={() => setActiveTab("businessmen")} type="button">
            Sellers ({businessmen.length})
          </button>
          <button className={activeTab === "customers" ? "tab active" : "tab"} onClick={() => setActiveTab("customers")} type="button">
            Customers ({customers.length})
          </button>
          <button className={activeTab === "logistics" ? "tab active" : "tab"} onClick={() => setActiveTab("logistics")} type="button">
            Logistics ({logistics.length})
          </button>
        </div>
      </div>

      <div className="panel table-scroll">
        <div className="panel-header">
          <h2>{activeTab === "businessmen" ? "Seller accounts" : activeTab === "customers" ? "Customer accounts" : "Logistics accounts"}</h2>
          <button className="primary-button" onClick={() => setShowAddModal(true)} type="button">
            Add New
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : currentData.length === 0 ? (
          <p className="muted">No records found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Details</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === "businessmen" && businessmen.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.business_name}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.owner_name}</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                  <td><button className="secondary-button" onClick={() => void handleDeleteBusinessman(item.id)} type="button">Delete</button></td>
                </tr>
              ))}
              {activeTab === "customers" && customers.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>Buyer</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                  <td><button className="secondary-button" onClick={() => void handleDeleteCustomer(item.id)} type="button">Delete</button></td>
                </tr>
              ))}
              {activeTab === "logistics" && logistics.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.account_type}</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                  <td><button className="secondary-button" onClick={() => void handleDeleteLogistics(item.id)} type="button">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </section>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Add {activeTab === "businessmen" ? "seller" : activeTab === "customers" ? "customer" : "logistics user"}</h2>
        </div>
        <form className="form-grid auth-form-two-col" onSubmit={handleSubmit}>
          {activeTab === "businessmen" ? (
            <>
              <label>Business name<input name="business_name" required /></label>
              <label>Owner name<input name="owner_name" required /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Phone<input name="phone" required /></label>
              <label>Password<input name="password" type="password" required minLength={8} /></label>
              <label>Category<input name="category" /></label>
              <label>Region<input name="region" defaultValue="Dar es Salaam" /></label>
              <label>Area<input name="area" /></label>
            </>
          ) : null}

          {activeTab === "customers" ? (
            <>
              <label>Name<input name="name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>Phone<input name="phone" /></label>
              <label>Password<input name="password" type="password" required minLength={8} /></label>
            </>
          ) : null}

          {activeTab === "logistics" ? (
            <>
              <label>Name<input name="name" required /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Phone<input name="phone" required /></label>
              <label>Password<input name="password" type="password" required minLength={8} /></label>
              <label>Account type
                <select name="account_type" defaultValue="individual">
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </label>
              <label>Vehicle type<input name="vehicle_type" /></label>
              <label className="full-width">Base area<input name="base_area" /></label>
            </>
          ) : null}

          <div className="modal-footer full-width">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
