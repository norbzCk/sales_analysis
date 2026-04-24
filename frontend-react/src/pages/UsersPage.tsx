import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import { EmptyState, InlineNotice, PageIntro, SectionCard, StatCards } from "../components/ui/PageSections";
import type { AdminUser } from "../types/domain";

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (["admin", "super_admin", "owner"].includes(String(user?.role || ""))) {
      void load();
    }
  }, [user?.role]);

  const roleOptions = useMemo(() => {
    const all = ["user", "admin", "super_admin", "owner"];
    if (["super_admin", "owner"].includes(String(user?.role || ""))) return all;
    return ["user", "admin"];
  }, [user?.role]);

  async function load() {
    try {
      const data = await apiRequest<AdminUser[]>("/auth/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "user"),
    };
    try {
      await apiRequest("/auth/users", { method: "POST", body: payload });
      event.currentTarget.reset();
      setFlash("User created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  if (!["admin", "super_admin", "owner"].includes(String(user?.role || ""))) {
    return <section className="panel"><h1>Users</h1><p className="muted">Only admin-level accounts can manage users.</p></section>;
  }

  return (
    <div className="app-page">
      <PageIntro
        eyebrow="Users"
        title="User management"
        description="Give operators a cleaner control surface with consistent cards, readable role labels, and a calm empty state for brand-new systems."
      />

      <StatCards
        items={[
          { id: "all", label: "Total users", value: users.length, note: users.length ? "Platform accounts in the system" : "No internal users created yet" },
          { id: "active", label: "Active accounts", value: users.filter((entry) => entry.is_active).length, note: "Currently enabled accounts" },
          { id: "admins", label: "Admin roles", value: users.filter((entry) => ["admin", "super_admin", "owner"].includes(entry.role)).length, note: "Operational access holders" },
        ]}
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {flash ? <InlineNotice tone="success">{flash}</InlineNotice> : null}

      <SectionCard title="Create user" description="Use the same modern form treatment here so the settings area feels part of the same product.">
        <form className="theme-form theme-form--two-col" onSubmit={handleSubmit}>
          <label className="theme-field">Name<input className="theme-input" name="name" required /></label>
          <label className="theme-field">Email<input className="theme-input" name="email" type="email" required /></label>
          <label className="theme-field">Password<input className="theme-input" name="password" type="password" minLength={8} required /></label>
          <label className="theme-field">
            Role
            <select className="theme-select" name="role" defaultValue="user">
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button className="theme-button" type="submit">Create user</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Team directory" description="Cards replace basic rows so status, role, and identity remain readable in both light and dark themes.">
        {!users.length ? (
          <EmptyState
            title="No users found"
            description="Fresh deployments should look intentional too. This space stays clean and unfilled until the first admin or team member is added."
          />
        ) : (
          <div className="entity-grid">
            {users.map((entry) => (
              <article key={entry.id} className="entity-card">
                <div className="entity-card__top">
                  <div className="entity-card__title">
                    <h3>{entry.name}</h3>
                    <p className="muted">{entry.email}</p>
                  </div>
                  <span className="meta-pill">{entry.is_active ? "Active" : "Disabled"}</span>
                </div>
                <div className="entity-card__meta">
                  <span className="meta-pill">Role: {entry.role}</span>
                  <span className="meta-pill">ID: {entry.id}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
