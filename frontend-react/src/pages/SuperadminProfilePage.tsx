import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import { EmptyState, InlineNotice, PageIntro, SectionCard, StatCards } from "../components/ui/PageSections";

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
    return (
      <div className="app-page">
        <EmptyState title="No profile data available" description="Your superadmin identity will appear here once the account data is available." />
      </div>
    );
  }

  return (
    <div className="app-page superadmin-page">
      <PageIntro
        eyebrow="Superadmin Profile"
        title="Platform identity and privilege view"
        description="A cleaner profile view for high-privilege users, with account identity, role clarity, and a more confident administrative presentation."
      />

      <StatCards
        items={[
          { id: "id", label: "Account ID", value: profile.id, note: "System identifier" },
          { id: "role", label: "Access role", value: profile.role || "super_admin", note: "Highest platform scope" },
          { id: "contact", label: "Primary contact", value: profile.email || "-", note: "Email used for access" },
        ]}
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {flash ? <InlineNotice tone="success">{flash}</InlineNotice> : null}

      <SectionCard title="Account details" description="Read-only superadmin identity information used across governance and audit workflows.">
        <div className="entity-grid">
          <article className="entity-card">
            <div className="entity-card__title">
              <h3>{profile.name || "Super Admin"}</h3>
              <p className="muted">Primary administrator</p>
            </div>
            <div className="entity-card__meta">
              <span className="meta-pill">ID: {profile.id}</span>
              <span className="meta-pill">Role: {profile.role || "super_admin"}</span>
              <span className="meta-pill">{profile.email || "No email on file"}</span>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
