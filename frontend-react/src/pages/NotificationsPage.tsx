import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/http";
import type { NotificationEntry } from "../types/domain";
import { useAuth } from "../features/auth/AuthContext";

interface NotificationResponse {
  items: NotificationEntry[];
  unread_count: number;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function severityClass(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "success") return "ok";
  if (normalized === "warning") return "warn";
  if (normalized === "error") return "danger";
  return "ok";
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);

  const isSeller = String(user?.role || "") === "seller";

  useEffect(() => {
    void load();
  }, [user?.role]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(""), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const endpoints = ["/notifications"];
      if (isSeller) {
        endpoints.push("/business/notifications");
      }

      const results = await Promise.all(
        endpoints.map((ep) =>
          apiRequest<NotificationResponse>(ep).catch(() => ({ items: [], unread_count: 0 }))
        )
      );

      const allItems = results.flatMap((r) => r.items || []);
      const totalUnread = results.reduce((acc, r) => acc + Number(r.unread_count || 0), 0);

      // Sort by created_at descending
      allItems.sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      });

      setNotifications(allItems.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);

      if (totalUnread > 0) {
        try {
          await apiRequest("/notifications/read-all", { method: "POST" });
          window.dispatchEvent(new CustomEvent("notifications-read"));
        } catch {
          setNotifications(allItems);
          setUnreadCount(totalUnread);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: NotificationEntry["id"]) {
    setError("");
    setFlash("");
    const previousNotifications = notifications;
    const nextNotifications = notifications.map((item) => (item.id === id ? { ...item, is_read: true } : item));
    const nextUnreadCount = nextNotifications.filter((item) => !item.is_read).length;

    setNotifications(nextNotifications);
    setUnreadCount(nextUnreadCount);

    try {
      await apiRequest(`/notifications/${id}/read`, { method: "POST" });
      setFlash("Notification marked as read.");
    } catch (err) {
      setNotifications(previousNotifications);
      setUnreadCount(previousNotifications.filter((item) => !item.is_read).length);
      setError(err instanceof Error ? err.message : "Failed to update notification");
    }
  }

  async function markAllRead() {
    setError("");
    setFlash("");
    const previousNotifications = notifications;
    const nextNotifications = notifications.map((item) => ({ ...item, is_read: true }));

    setNotifications(nextNotifications);
    setUnreadCount(0);

    try {
      await apiRequest("/notifications/read-all", { method: "POST" });
      setFlash("All notifications marked as read.");
    } catch (err) {
      setNotifications(previousNotifications);
      setUnreadCount(previousNotifications.filter((item) => !item.is_read).length);
      setError(err instanceof Error ? err.message : "Failed to update notifications");
    }
  }

  return (
    <div className="space-y-6 animate-soft-enter">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-2">Notifications</p>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Alerts, emails, and account activity</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Track login alerts, payment updates, delivery events, and order activity in one inbox.</p>
          </div>
          <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium" type="button" onClick={markAllRead} disabled={!unreadCount}>
            Mark all read
          </button>
        </div>
      </div>

      {error ? <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-bold flex items-center gap-3 border border-red-100 dark:border-red-800">{error}</div> : null}
      {flash ? <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-3 border border-emerald-100 dark:border-emerald-800">{flash}</div> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <article className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total</span>
          <strong className="text-2xl font-display font-black text-slate-900 dark:text-white">{loading ? "..." : notifications.length}</strong>
        </article>
        <article className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unread</span>
          <strong className="text-2xl font-display font-black text-slate-900 dark:text-white">{loading ? "..." : unreadCount}</strong>
        </article>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? <p className="p-6 text-slate-500 dark:text-slate-400">Loading notifications...</p> : null}
        {!loading && !notifications.length ? <p className="p-6 text-slate-500 dark:text-slate-400">No notifications yet.</p> : null}
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {notifications.map((item) => (
            <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                <strong className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</strong>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  severityClass(item.severity) === "ok" ? "bg-green-100 text-green-800" :
                  severityClass(item.severity) === "warn" ? "bg-yellow-100 text-yellow-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  {item.is_read ? "Read" : "New"}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{item.message}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{formatDateTime(item.created_at)}</span>
                <span>{item.type || "system"}</span>
                {item.email_status ? <span>Email: {item.email_status}</span> : null}
                {item.action_href ? <Link to={item.action_href} className="text-brand hover:underline">Open related page</Link> : null}
              </div>
              {!item.is_read ? (
                <button className="mt-3 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium" type="button" onClick={() => void markRead(item.id)}>
                  Mark read
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
