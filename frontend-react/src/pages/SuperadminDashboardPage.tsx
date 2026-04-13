import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";

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

interface Stats {
  total_businessmen: number;
  total_customers: number;
  total_logistics: number;
}

export function SuperadminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ total_businessmen: 0, total_customers: 0, total_logistics: 0 });
  const [businessmen, setBusinessmen] = useState<Businessman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logistics, setLogistics] = useState<LogisticsUser[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"businessmen" | "customers" | "logistics">("businessmen");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, businessmenData, customersData, logisticsData] = await Promise.all([
        apiRequest<Stats>("/superadmin/stats"),
        apiRequest<Businessman[]>("/superadmin/businessmen"),
        apiRequest<Customer[]>("/superadmin/customers"),
        apiRequest<LogisticsUser[]>("/superadmin/logistics"),
      ]);
      setStats(statsData);
      setBusinessmen(businessmenData);
      setCustomers(customersData);
      setLogistics(logisticsData);
    } catch {
      setStats({ total_businessmen: 0, total_customers: 0, total_logistics: 0 });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBusinessman(id: number) {
    if (!confirm("Are you sure you want to delete this businessman?")) return;
    try {
      await apiRequest(`/superadmin/businessmen/${id}`, { method: "DELETE" });
      setSuccess("Businessman deleted successfully");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleDeleteCustomer(id: number) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await apiRequest(`/superadmin/customers/${id}`, { method: "DELETE" });
      setSuccess("Customer deleted successfully");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleDeleteLogistics(id: number) {
    if (!confirm("Are you sure you want to delete this logistics user?")) return;
    try {
      await apiRequest(`/superadmin/logistics/${id}`, { method: "DELETE" });
      setSuccess("Logistics user deleted successfully");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const currentData = activeTab === "businessmen" ? businessmen : activeTab === "customers" ? customers : logistics;

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Superadmin Dashboard</p>
            <h1>Platform Management</h1>
          </div>
          <button className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <p className="muted">Manage all users: businessmen, customers, and logistics partners.</p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {success ? <p className="alert success">{success}</p> : null}

      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-label">Businessmen</span>
          <strong>{loading ? "..." : stats.total_businessmen}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Customers</span>
          <strong>{loading ? "..." : stats.total_customers}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Logistics</span>
          <strong>{loading ? "..." : stats.total_logistics}</strong>
        </article>
      </div>

      <div className="panel">
        <div className="tab-row">
          <button
            className={activeTab === "businessmen" ? "tab active" : "tab"}
            onClick={() => setActiveTab("businessmen")}
            type="button"
          >
            Businessmen ({stats.total_businessmen})
          </button>
          <button
            className={activeTab === "customers" ? "tab active" : "tab"}
            onClick={() => setActiveTab("customers")}
            type="button"
          >
            Customers ({stats.total_customers})
          </button>
          <button
            className={activeTab === "logistics" ? "tab active" : "tab"}
            onClick={() => setActiveTab("logistics")}
            type="button"
          >
            Logistics ({stats.total_logistics})
          </button>
        </div>
      </div>

      <div className="panel table-scroll">
        <div className="panel-header">
          <h2>{activeTab === "businessmen" ? "Businessmen" : activeTab === "customers" ? "Customers" : "Logistics Users"}</h2>
          <button className="primary-button" onClick={() => setShowAddModal(true)}>
            Add New
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : currentData.length === 0 ? (
          <p className="muted">No {activeTab} found.</p>
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
              {activeTab === "businessmen" && businessmen.map((item: Businessman) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.business_name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>{item.owner_name}</td>
                  <td>{item.created_at || "-"}</td>
                  <td>
                    <button className="danger-button" onClick={() => handleDeleteBusinessman(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {activeTab === "customers" && customers.map((item: Customer) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>-</td>
                  <td>{item.created_at || "-"}</td>
                  <td>
                    <button className="danger-button" onClick={() => handleDeleteCustomer(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {activeTab === "logistics" && logistics.map((item: LogisticsUser) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>{item.account_type}</td>
                  <td>{item.created_at || "-"}</td>
                  <td>
                    <button className="danger-button" onClick={() => handleDeleteLogistics(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New {activeTab === "businessmen" ? "Businessman" : activeTab === "customers" ? "Customer" : "Logistics User"}</h2>
              <button onClick={() => setShowAddModal(false)}>Close</button>
            </div>
            <AddUserForm
              userType={activeTab}
              onSuccess={() => {
                setShowAddModal(false);
                loadData();
              }}
              onError={(err) => setError(err)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function AddUserForm({
  userType,
  onSuccess,
  onError,
}: {
  userType: "businessmen" | "customers" | "logistics";
  onSuccess: () => void;
  onError: (err: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    business_name: "",
    owner_name: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    onError("");

    try {
      const payload = { ...formData, role: userType === "businessmen" ? "seller" : userType === "customers" ? "user" : "logistics" };

      if (userType === "businessmen") {
        await apiRequest("/superadmin/businessmen", { method: "POST", body: payload });
      } else if (userType === "customers") {
        await apiRequest("/superadmin/customers", { method: "POST", body: payload });
      } else {
        await apiRequest("/superadmin/logistics", { method: "POST", body: payload });
      }

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {userType === "businessmen" && (
        <>
          <label>
            Business Name
            <input name="business_name" required onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} />
          </label>
          <label>
            Owner Name
            <input name="owner_name" required onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })} />
          </label>
        </>
      )}
      <label>
        Name
        <input name="name" required onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
      </label>
      <label>
        Email
        <input name="email" type="email" required onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      </label>
      <label>
        Phone
        <input name="phone" required onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      </label>
      <label>
        Password
        <input name="password" type="password" required onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
      </label>
      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Adding..." : "Add User"}
      </button>
    </form>
  );
}