import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
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
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Users</p><h1>User management</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" minLength={8} required /></label>
        <label>
          Role
          <select name="role" defaultValue="user">
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit">Create user</button>
      </form>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {!users.length ? <tr><td colSpan={5}>No users found.</td></tr> : null}
            {users.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.id}</td>
                <td>{entry.name}</td>
                <td>{entry.email}</td>
                <td>{entry.role}</td>
                <td>{entry.is_active ? "Active" : "Disabled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
