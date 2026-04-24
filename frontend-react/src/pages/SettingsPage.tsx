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
    <section className="p-4 md:p-8 space-y-8 animate-soft-enter">
      <div className="space-y-1">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">Preferences</span>
        <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your account, notifications, and preferences.</p>
      </div>
      
      {error ? <p className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-bold flex items-center gap-3 border border-red-100 dark:border-red-800">{error}</p> : null}
      {flash ? <p className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-3 border border-emerald-100 dark:border-emerald-800">{flash}</p> : null}
      
      {/* Theme Section */}
      <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Appearance</h2>
        <p className="text-slate-500 dark:text-slate-400">Choose your preferred theme.</p>
        <div className="flex gap-4 flex-wrap mt-4">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-6 py-3 rounded-xl border-2 font-bold transition-all capitalize
                ${theme === t 
                  ? 'border-brand bg-brand text-white' 
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand/50'
                }`}
            >
              {t === "light" && "☀️"} {t === "dark" && "🌙"} {t === "system" && "⚙️"} {t}
            </button>
          ))}
        </div>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
          Current theme: <strong className="text-slate-900 dark:text-white">{effectiveTheme}</strong>
        </p>
      </div>

      <form className="space-y-8" onSubmit={saveSettings}>
        {/* Notification Settings */}
        <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Notifications</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage how and when you receive updates.</p>
        
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.email_orders}
              onChange={(e) => setNotifications((prev) => ({ ...prev, email_orders: e.target.checked }))}
              className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
            />
            <span className="text-slate-700 dark:text-slate-300">Email me about orders and deliveries</span>
          </label>
        
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.email_promotions}
              onChange={(e) => setNotifications((prev) => ({ ...prev, email_promotions: e.target.checked }))}
              className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
            />
            <span className="text-slate-700 dark:text-slate-300">Email me about promotions and deals</span>
          </label>
        
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.email_updates}
              onChange={(e) => setNotifications((prev) => ({ ...prev, email_updates: e.target.checked }))}
              className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
            />
            <span className="text-slate-700 dark:text-slate-300">Email me about platform updates</span>
          </label>
        
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.sms_enabled}
              onChange={(e) => setNotifications((prev) => ({ ...prev, sms_enabled: e.target.checked }))}
              className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
            />
            <span className="text-slate-700 dark:text-slate-300">Send me important alerts via SMS</span>
          </label>
        </div>

        {/* Account Security */}
        <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Account Security</h2>
          <p className="text-slate-500 dark:text-slate-400">Protect and control your account access.</p>
        
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={account.two_factor_enabled}
              onChange={(e) => setAccount((prev) => ({ ...prev, two_factor_enabled: e.target.checked }))}
              className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
            />
            <span className="text-slate-700 dark:text-slate-300">Enable two-factor authentication</span>
          </label>
        
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Session Timeout (minutes)</span>
            <input
              type="number"
              min="5"
              max="480"
              value={account.session_timeout}
              onChange={(e) => setAccount((prev) => ({ ...prev, session_timeout: Number(e.target.value) }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-transparent focus:border-brand/20 focus:bg-white dark:focus:bg-slate-600 rounded-xl outline-none transition-all font-semibold text-slate-900 dark:text-white"
            />
          </label>
        </div>

        {/* Role-Specific Settings */}
        {isSeller && (
          <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Seller Dashboard</h2>
            <p className="text-slate-500 dark:text-slate-400">Customize your seller experience.</p>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Notify me of new orders immediately</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Show inventory forecasting alerts</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Display competitor price alerts</span>
            </label>
          </div>
        )}
      
        {isLogistics && (
          <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Logistics Tracking</h2>
            <p className="text-slate-500 dark:text-slate-400">Configure delivery and route preferences.</p>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Show real-time route optimization</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.sms_enabled}
                onChange={(e) => setNotifications((prev) => ({ ...prev, sms_enabled: e.target.checked }))}
                className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
              />
              <span className="text-slate-700 dark:text-slate-300">SMS alerts for delivery status changes</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Track vehicle performance metrics</span>
            </label>
          </div>
        )}
      
        {isCustomer && (
          <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Shopping Preferences</h2>
            <p className="text-slate-500 dark:text-slate-400">Personalize your buying experience.</p>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Show recommended products</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.email_promotions}
                onChange={(e) => setNotifications((prev) => ({ ...prev, email_promotions: e.target.checked }))}
                className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
              />
              <span className="text-slate-700 dark:text-slate-300">Notify me about product restocks in my saved searches</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Save favorite sellers and products</span>
            </label>
          </div>
        )}
      
        {isAdmin && (
          <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
            <p className="text-slate-500 dark:text-slate-400">Configure administrative oversight.</p>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Show platform health metrics</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.email_updates}
                onChange={(e) => setNotifications((prev) => ({ ...prev, email_updates: e.target.checked }))}
                className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
              />
              <span className="text-slate-700 dark:text-slate-300">Notify me of system alerts and issues</span>
            </label>
          
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand focus:ring-brand" />
              <span className="text-slate-700 dark:text-slate-300">Enable detailed audit logging</span>
            </label>
          </div>
        )}

        <div>
          <button className="btn-primary !py-4 !px-8" type="submit">
            Save Settings
          </button>
        </div>
      </form>
      
      <div className="glass-card dark:bg-slate-800/50 p-8 space-y-4" style={{ background: "var(--surface-alt)" }}>
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">Data & Privacy</h3>
        <p className="text-slate-500 dark:text-slate-400">Your data is encrypted and secure. Review our privacy policy for more details.</p>
        <div className="flex gap-4 mt-4">
          <button className="btn-secondary">Download My Data</button>
          <button className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all">Delete Account</button>
        </div>
      </div>
    </section>
  );
}
