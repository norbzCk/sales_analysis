import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { useTheme } from "../features/auth/ThemeContext";
import { apiRequest } from "../lib/http";

interface NotificationSettings {
  email_orders: boolean;
  email_promotions: boolean;
  email_updates: boolean;
  sms_enabled: boolean;
}

interface AccountSettings {
  two_factor_enabled: boolean;
  session_timeout: number; // in minutes
  api_key_active: boolean;
}

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_orders: true,
    email_promotions: false,
    email_updates: true,
    sms_enabled: false,
  });
  const [account, setAccount] = useState<AccountSettings>({
    two_factor_enabled: false,
    session_timeout: 30,
    api_key_active: false,
  });
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  const role = String(user?.role || "");
  const isSeller = role === "seller";
  const isLogistics = role === "logistics";
  const isCustomer = role === "user";
  const isAdmin = ["admin", "super_admin", "owner"].includes(role);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await apiRequest<{
        notifications?: NotificationSettings;
        account?: AccountSettings;
      }>("/settings/", { method: "GET" });
      if (data.notifications) setNotifications(data.notifications);
      if (data.account) setAccount(data.account);
    } catch {
      // Use defaults if not available
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    try {
      await apiRequest("/settings/", {
        method: "PUT",
        body: { notifications, account },
      });
      setFlash("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">Settings</p>
        <h1>Preferences & Controls</h1>
        <p className="muted">Manage your account, notifications, and preferences.</p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      {/* Theme Section */}
      <div className="panel">
        <h2>Appearance</h2>
        <p className="muted">Choose your preferred theme.</p>
        <div style={{ display: "flex", gap: "16px", marginTop: "20px", flexWrap: "wrap" }}>
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                padding: "12px 20px",
                borderRadius: "8px",
                border: theme === t ? "2px solid var(--brand-blue)" : "2px solid #ddd",
                background: theme === t ? "var(--brand-blue)" : "white",
                color: theme === t ? "white" : "var(--text-color)",
                cursor: "pointer",
                fontWeight: theme === t ? "700" : "500",
                textTransform: "capitalize",
              }}
            >
              {t === "light" && "☀️"} {t === "dark" && "🌙"} {t === "system" && "⚙️"} {t}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: "12px" }}>
          Current theme: <strong>{effectiveTheme}</strong>
        </p>
      </div>

      <form className="panel form-grid" onSubmit={saveSettings} style={{ gap: "20px" }}>
        {/* Notification Settings */}
        <div style={{ gridColumn: "1 / -1" }}>
          <h2>Notifications</h2>
          <p className="muted">Manage how and when you receive updates.</p>
        </div>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={notifications.email_orders}
            onChange={(e) => setNotifications((prev) => ({ ...prev, email_orders: e.target.checked }))}
          />
          <span>Email me about orders and deliveries</span>
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={notifications.email_promotions}
            onChange={(e) => setNotifications((prev) => ({ ...prev, email_promotions: e.target.checked }))}
          />
          <span>Email me about promotions and deals</span>
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={notifications.email_updates}
            onChange={(e) => setNotifications((prev) => ({ ...prev, email_updates: e.target.checked }))}
          />
          <span>Email me about platform updates</span>
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={notifications.sms_enabled}
            onChange={(e) => setNotifications((prev) => ({ ...prev, sms_enabled: e.target.checked }))}
          />
          <span>Send me important alerts via SMS</span>
        </label>

        {/* Account Security */}
        <div style={{ gridColumn: "1 / -1" }}>
          <h2>Account Security</h2>
          <p className="muted">Protect and control your account access.</p>
        </div>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={account.two_factor_enabled}
            onChange={(e) => setAccount((prev) => ({ ...prev, two_factor_enabled: e.target.checked }))}
          />
          <span>Enable two-factor authentication</span>
        </label>

        <label>
          Session Timeout (minutes)
          <input
            type="number"
            min="5"
            max="480"
            value={account.session_timeout}
            onChange={(e) => setAccount((prev) => ({ ...prev, session_timeout: Number(e.target.value) }))}
          />
        </label>

        {/* Role-Specific Settings */}
        {isSeller && (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <h2>Seller Dashboard</h2>
              <p className="muted">Customize your seller experience.</p>
            </div>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifications.email_orders}
                onChange={(e) => setNotifications((prev) => ({ ...prev, email_orders: e.target.checked }))}
              />
              <span>Notify me of new orders immediately</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Show inventory forecasting alerts</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Display competitor price alerts</span>
            </label>
          </>
        )}

        {isLogistics && (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <h2>Logistics Tracking</h2>
              <p className="muted">Configure delivery and route preferences.</p>
            </div>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Show real-time route optimization</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifications.sms_enabled}
                onChange={(e) => setNotifications((prev) => ({ ...prev, sms_enabled: e.target.checked }))}
              />
              <span>SMS alerts for delivery status changes</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Track vehicle performance metrics</span>
            </label>
          </>
        )}

        {isCustomer && (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <h2>Shopping Preferences</h2>
              <p className="muted">Personalize your buying experience.</p>
            </div>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Show recommended products</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifications.email_promotions}
                onChange={(e) => setNotifications((prev) => ({ ...prev, email_promotions: e.target.checked }))}
              />
              <span>Notify me about product restocks in my saved searches</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Save favorite sellers and products</span>
            </label>
          </>
        )}

        {isAdmin && (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <h2>Admin Dashboard</h2>
              <p className="muted">Configure administrative oversight.</p>
            </div>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Show platform health metrics</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifications.email_updates}
                onChange={(e) => setNotifications((prev) => ({ ...prev, email_updates: e.target.checked }))}
              />
              <span>Notify me of system alerts and issues</span>
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked />
              <span>Enable detailed audit logging</span>
            </label>
          </>
        )}

        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button" type="submit">
            Save Settings
          </button>
        </div>
      </form>

      <div className="panel" style={{ background: "var(--surface-alt)" }}>
        <h3>Data & Privacy</h3>
        <p className="muted">Your data is encrypted and secure. Review our privacy policy for more details.</p>
        <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
          <button className="secondary-button">Download My Data</button>
          <button className="secondary-button" style={{ color: "var(--danger)" }}>
            Delete Account
          </button>
        </div>
      </div>
    </section>
  );
}
