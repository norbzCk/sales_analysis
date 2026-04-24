import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import { EmptyState, InlineNotice, PageIntro, SectionCard, StatCards } from "../components/ui/PageSections";
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
    <div className="app-page">
      <PageIntro
        eyebrow="Providers"
        title="Provider management"
        description="Unify supplier management into cards with clear verification, response, and order threshold signals so the experience feels dependable for public users and operators alike."
      />

      <StatCards
        items={[
          { id: "all", label: "Total providers", value: providers.length, note: providers.length ? "Suppliers currently available" : "Provider network not started yet" },
          { id: "verified", label: "Verified providers", value: providers.filter((item) => item.verified).length, note: "Trusted suppliers ready to feature" },
          { id: "contactable", label: "Reachable providers", value: providers.filter((item) => item.email || item.phone).length, note: "Suppliers with visible contact details" },
        ]}
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {flash ? <InlineNotice tone="success">{flash}</InlineNotice> : null}

      <SectionCard title="Add provider" description="Capture supplier details with the same visual language used on dashboard surfaces.">
        <form className="theme-form theme-form--two-col" onSubmit={handleSubmit}>
          <label className="theme-field">Name<input className="theme-input" name="name" required /></label>
          <label className="theme-field">Location<input className="theme-input" name="location" /></label>
          <label className="theme-field">Email<input className="theme-input" name="email" type="email" /></label>
          <label className="theme-field">Phone<input className="theme-input" name="phone" /></label>
          <label className="theme-field">Response time<input className="theme-input" name="response_time" /></label>
          <label className="theme-field">Minimum order qty<input className="theme-input" name="min_order_qty" /></label>
          <label className="theme-field">Verification
            <select className="theme-select" name="verified" defaultValue="">
              <option value="">Pending review</option>
              <option value="on">Verified supplier</option>
            </select>
          </label>
          <div className="button-row">
            <button className="theme-button" type="submit">Save provider</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Provider directory" description="Every provider now renders as a responsive card instead of an uneven row, which keeps the screen uniform across sizes.">
        {!providers.length ? (
          <EmptyState
            title="No providers yet"
            description="The marketplace is still fresh here. Once providers are added, they will appear as readable cards with verification and contact details."
          />
        ) : (
          <div className="entity-grid">
            {providers.map((provider) => (
              <article key={provider.id} className="entity-card">
                <div className="entity-card__top">
                  <div className="entity-card__title">
                    <h3>{provider.name}</h3>
                    <p className="muted">{provider.location || "Location pending"}</p>
                  </div>
                  <span className="meta-pill">{provider.verified ? "Verified" : "Pending review"}</span>
                </div>
                <div className="entity-card__meta">
                  <span className="meta-pill">{provider.email || "No email yet"}</span>
                  <span className="meta-pill">{provider.phone || "No phone yet"}</span>
                  <span className="meta-pill">{provider.response_time || "Response time not set"}</span>
                  <span className="meta-pill">{provider.min_order_qty || "MOQ not set"}</span>
                </div>
                <div className="entity-card__actions">
                  <span className="muted">Provider #{provider.id}</span>
                  <button className="theme-button theme-button--secondary" onClick={() => handleDelete(provider.id)} type="button">
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
