import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/http";
import type { NotificationEntry } from "../types/domain";

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
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(""), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<NotificationResponse>("/notifications");
      const items = data.items || [];
      const unread = Number(data.unread_count || 0);
      setNotifications(items.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);

      if (unread > 0) {
        try {
          await apiRequest("/notifications/read-all", { method: "POST" });
          // Refresh the global unread count
          window.dispatchEvent(new CustomEvent('notifications-read'));
        } catch {
          setNotifications(items);
          setUnreadCount(unread);
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
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Notifications</p>
            <h1>Alerts, emails, and account activity</h1>
            <p className="muted">Track login alerts, payment updates, delivery events, and order activity in one inbox.</p>
          </div>
          <button className="secondary-button" type="button" onClick={markAllRead} disabled={!unreadCount}>
            Mark all read
          </button>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="stat-grid">
        <article className="stat-card"><span className="stat-label">Total</span><strong>{loading ? "..." : notifications.length}</strong></article>
        <article className="stat-card"><span className="stat-label">Unread</span><strong>{loading ? "..." : unreadCount}</strong></article>
      </div>

      <div className="panel stack-list">
        {loading ? <p className="muted">Loading notifications...</p> : null}
        {!loading && !notifications.length ? <p className="muted">No notifications yet.</p> : null}
        {notifications.map((item) => (
          <article key={item.id} className="list-card notification-card">
            <div className="stack-list">
              <div className="panel-header">
                <strong>{item.title}</strong>
                <span className={`status-pill ${severityClass(item.severity)}`}>{item.is_read ? "Read" : "New"}</span>
              </div>
              <p className="muted">{item.message}</p>
              <div className="inline-link-row">
                <span className="muted">{formatDateTime(item.created_at)}</span>
                <span className="muted">{item.type || "system"}</span>
                {item.email_status ? <span className="muted">Email: {item.email_status}</span> : null}
                {item.action_href ? <Link to={item.action_href}>Open related page</Link> : null}
              </div>
            </div>
            {!item.is_read ? (
              <button className="secondary-button" type="button" onClick={() => void markRead(item.id)}>
                Mark read
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
