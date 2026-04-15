import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";

interface SuperadminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function SuperadminProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SuperadminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const data = await apiRequest<SuperadminUser>("/superadmin/me");
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
      if (user) {
        setProfile({
          id: user.id ?? 0,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "super_admin",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <section className="panel"><p>Loading profile...</p></section>;
  }

  if (!profile) {
    return <section className="panel"><p>No profile data available.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Superadmin</p>
            <h1>Profile Settings</h1>
          </div>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <article className="panel stack-list">
        <div className="panel-header">
          <h2>Account Details</h2>
        </div>
        <div className="list-card"><strong>ID</strong><span>{profile.id}</span></div>
        <div className="list-card"><strong>Name</strong><span>{profile.name || "-"}</span></div>
        <div className="list-card"><strong>Email</strong><span>{profile.email || "-"}</span></div>
        <div className="list-card"><strong>Role</strong><span>{profile.role || "super_admin"}</span></div>
      </article>
    </section>
  );
}