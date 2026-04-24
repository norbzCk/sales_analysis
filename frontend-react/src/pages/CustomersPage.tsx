import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import { EmptyState, InlineNotice, PageIntro, SectionCard, StatCards } from "../components/ui/PageSections";
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
    <div className="app-page">
      <PageIntro
        eyebrow="Customers"
        title="Customer records"
        description="Keep the public marketplace approachable for first-time buyers by maintaining a clean, searchable customer directory with clear empty states."
      />

      <StatCards
        items={[
          { id: "all", label: "Total customers", value: customers.length, note: customers.length ? "Accounts already registered" : "Fresh marketplace, no records yet" },
          { id: "contactable", label: "Reachable contacts", value: customers.filter((item) => item.email || item.phone).length, note: "Profiles with email or phone" },
          { id: "locations", label: "Known locations", value: customers.filter((item) => item.location).length, note: "Customer locations captured" },
        ]}
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {flash ? <InlineNotice tone="success">{flash}</InlineNotice> : null}

      <SectionCard title="Add customer" description="Create a new customer profile with the same polished form treatment used across the app.">
        <form className="theme-form theme-form--two-col" onSubmit={handleSubmit}>
          <label className="theme-field">Name<input className="theme-input" name="name" required /></label>
          <label className="theme-field">Email<input className="theme-input" name="email" type="email" /></label>
          <label className="theme-field">Phone<input className="theme-input" name="phone" /></label>
          <label className="theme-field">Location<input className="theme-input" name="location" /></label>
          <div className="button-row">
            <button className="theme-button" type="submit">Save customer</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Customer directory" description="Cards keep the directory readable on both desktop and mobile instead of falling back to uneven rows.">
        {!customers.length ? (
          <EmptyState
            title="No customers yet"
            description="New users should land in a calm, unfilled experience. Customer stats stay empty until the first records are created."
          />
        ) : (
          <div className="entity-grid">
            {customers.map((customer) => (
              <article key={customer.id} className="entity-card">
                <div className="entity-card__top">
                  <div className="entity-card__title">
                    <h3>{customer.name}</h3>
                    <p className="muted">Customer #{customer.id}</p>
                  </div>
                  <span className="meta-pill">{customer.location || "Location pending"}</span>
                </div>
                <div className="entity-card__meta">
                  <span className="meta-pill">{customer.email || "No email yet"}</span>
                  <span className="meta-pill">{customer.phone || "No phone yet"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
