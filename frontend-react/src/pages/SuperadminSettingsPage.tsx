import { useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";

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
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Superadmin settings</p>
        <h1>Privilege controls and operating rules</h1>
        <p className="muted">These settings are about platform oversight, verification policy, and administrative guardrails.</p>
      </div>

      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="buyer-section-grid">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Privilege profile</p>
              <h2>{user?.name || "Super Admin"}</h2>
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
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Verification policy</p>
              <h2>Approval guardrails</h2>
            </div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={autoApproveSellers} onChange={(event) => setAutoApproveSellers(event.target.checked)} />
            Auto-approve sellers after review batch
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={autoApproveLogistics} onChange={(event) => setAutoApproveLogistics(event.target.checked)} />
            Auto-approve logistics after review batch
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={securityLock} onChange={(event) => setSecurityLock(event.target.checked)} />
            Require manual human review for high-risk accounts
          </label>
          <button className="primary-button" type="button" onClick={savePreferences}>
            Save settings
          </button>
        </article>
      </div>

      <article className="panel buyer-card">
        <div className="buyer-card__header">
          <div>
            <p className="eyebrow">Platform governance</p>
            <h2>Recommended operating posture</h2>
          </div>
        </div>
        <div className="stack-list">
          <div className="list-card"><strong>Verification reviews</strong><span>Prioritize pending sellers and riders before enabling marketplace growth campaigns.</span></div>
          <div className="list-card"><strong>Revenue oversight</strong><span>Keep the dashboard focused on platform revenue, fulfillment pace, inventory pressure, and trust signals.</span></div>
          <div className="list-card"><strong>Security</strong><span>High-privilege actions should remain explicit and manually reviewed.</span></div>
        </div>
      </article>
    </section>
  );
}
