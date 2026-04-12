import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { Provider } from "../types/domain";

function canManage(role?: string) {
  return ["admin", "super_admin", "owner", "seller"].includes(String(role || ""));
}

export function ProvidersPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const data = await apiRequest<Provider[]>("/providers/");
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      location: String(form.get("location") || "").trim() || null,
      email: String(form.get("email") || "").trim() || null,
      phone: String(form.get("phone") || "").trim() || null,
      response_time: String(form.get("response_time") || "").trim() || null,
      min_order_qty: String(form.get("min_order_qty") || "").trim() || null,
      verified: Boolean(form.get("verified")),
    };
    try {
      await apiRequest("/providers/", { method: "POST", body: payload });
      event.currentTarget.reset();
      setFlash("Provider saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save provider");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this provider?")) return;
    try {
      await apiRequest(`/providers/${id}`, { method: "DELETE" });
      setFlash("Provider deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete provider");
    }
  }

  if (!canManage(user?.role)) {
    return <section className="panel"><h1>Providers</h1><p className="muted">Only admin-level accounts can manage providers.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Providers</p><h1>Provider management</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>Name<input name="name" required /></label>
        <label>Location<input name="location" /></label>
        <label>Email<input name="email" type="email" /></label>
        <label>Phone<input name="phone" /></label>
        <label>Response time<input name="response_time" /></label>
        <label>Minimum order qty<input name="min_order_qty" /></label>
        <label className="checkbox-row"><input name="verified" type="checkbox" /> Verified</label>
        <button className="primary-button" type="submit">Save provider</button>
      </form>

      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Location</th><th>Email</th><th>Phone</th><th>Status</th><th>Response</th><th>MOQ</th><th /></tr></thead>
          <tbody>
            {!providers.length ? <tr><td colSpan={8}>No providers yet.</td></tr> : null}
            {providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.name}</td>
                <td>{provider.location || "-"}</td>
                <td>{provider.email || "-"}</td>
                <td>{provider.phone || "-"}</td>
                <td>{provider.verified ? "Verified" : "Pending"}</td>
                <td>{provider.response_time || "-"}</td>
                <td>{provider.min_order_qty || "-"}</td>
                <td><button className="secondary-button" onClick={() => handleDelete(provider.id)} type="button">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
