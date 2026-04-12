import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { Customer } from "../types/domain";

export function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (["super_admin", "owner"].includes(String(user?.role || ""))) {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      const data = await apiRequest<Customer[]>("/customers/");
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim() || null,
      phone: String(form.get("phone") || "").trim() || null,
      location: String(form.get("location") || "").trim() || null,
    };
    try {
      await apiRequest("/customers/", { method: "POST", body: payload });
      event.currentTarget.reset();
      setFlash("Customer saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer");
    }
  }

  if (!["super_admin", "owner"].includes(String(user?.role || ""))) {
    return <section className="panel"><h1>Customers</h1><p className="muted">Only owner and super admin accounts can access customer administration.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Customers</p><h1>Customer records</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" /></label>
        <label>Phone<input name="phone" /></label>
        <label>Location<input name="location" /></label>
        <button className="primary-button" type="submit">Save customer</button>
      </form>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th></tr></thead>
          <tbody>
            {!customers.length ? <tr><td colSpan={4}>No customers yet.</td></tr> : null}
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.email || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{customer.location || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
