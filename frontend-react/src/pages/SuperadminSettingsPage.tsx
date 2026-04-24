import { useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { InlineNotice, PageIntro, SectionCard, StatCards } from "../components/ui/PageSections";

export function SuperadminSettingsPage() {
  const { user } = useAuth();
  const [autoApproveSellers, setAutoApproveSellers] = useState(false);
  const [autoApproveLogistics, setAutoApproveLogistics] = useState(false);
  const [securityLock, setSecurityLock] = useState(true);
  const [flash, setFlash] = useState("");

  const accessSummary = useMemo(
    () => [
      "Approve or reject seller verification",
      "Approve or reject logistics verification",
      "View system-wide sales and delivery health",
      "Manage high-privilege accounts and platform rules",
    ],
    [],
  );

  function savePreferences() {
    localStorage.setItem(
      "superadmin_settings",
      JSON.stringify({ autoApproveSellers, autoApproveLogistics, securityLock }),
    );
    setFlash("Superadmin preferences saved on this device.");
  }

  return (
    <div className="app-page superadmin-page">
      <PageIntro
        eyebrow="Superadmin Settings"
        title="Privilege controls and operating rules"
        description="Manage platform oversight, verification policy, and high-privilege guardrails from one modern governance workspace."
      />

      <StatCards
        items={[
          { id: "scope", label: "Privilege scope", value: "Full", note: "Platform-wide authority" },
          { id: "seller", label: "Seller approval", value: autoApproveSellers ? "Auto" : "Manual", note: "Current verification posture" },
          { id: "logistics", label: "Logistics approval", value: autoApproveLogistics ? "Auto" : "Manual", note: "Current rider onboarding mode" },
          { id: "risk", label: "Risk review", value: securityLock ? "Strict" : "Relaxed", note: "Manual control for sensitive cases" },
        ]}
      />

      {flash ? <InlineNotice tone="success">{flash}</InlineNotice> : null}

      <div className="buyer-section-grid">
        <SectionCard title="Privilege profile" description="A compact summary of what this superadmin account is expected to control.">
          <div className="superadmin-identity">
            <div>
              <p className="eyebrow">Current operator</p>
              <h3>{user?.name || "Super Admin"}</h3>
            </div>
            <span className="role-chip">{user?.role || "super_admin"}</span>
          </div>
          <div className="stack-list">
            {accessSummary.map((item) => (
              <div key={item} className="list-card">
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Verification policy" description="Control how much human review is required before accounts become active.">
          <div className="superadmin-toggle-grid">
            <label className="checkbox-row superadmin-toggle">
              <input type="checkbox" checked={autoApproveSellers} onChange={(event) => setAutoApproveSellers(event.target.checked)} />
              <span>Auto-approve sellers after review batch</span>
            </label>
            <label className="checkbox-row superadmin-toggle">
              <input type="checkbox" checked={autoApproveLogistics} onChange={(event) => setAutoApproveLogistics(event.target.checked)} />
              <span>Auto-approve logistics after review batch</span>
            </label>
            <label className="checkbox-row superadmin-toggle">
              <input type="checkbox" checked={securityLock} onChange={(event) => setSecurityLock(event.target.checked)} />
              <span>Require manual review for high-risk accounts</span>
            </label>
          </div>
          <div className="button-row">
            <button className="theme-button" type="button" onClick={savePreferences}>
              Save settings
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Platform governance" description="Recommended operating posture to keep trust, growth, and security balanced.">
        <div className="entity-grid">
          <article className="entity-card">
            <div className="entity-card__title">
              <h3>Verification reviews</h3>
              <p className="muted">Prioritize pending sellers and riders before enabling growth campaigns.</p>
            </div>
          </article>
          <article className="entity-card">
            <div className="entity-card__title">
              <h3>Revenue oversight</h3>
              <p className="muted">Keep monitoring focused on revenue, fulfillment pace, inventory pressure, and trust signals.</p>
            </div>
          </article>
          <article className="entity-card">
            <div className="entity-card__title">
              <h3>Security</h3>
              <p className="muted">High-privilege actions should remain explicit, visible, and manually reviewed.</p>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
