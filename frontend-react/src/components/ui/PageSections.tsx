import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  badges?: ReactNode;
};

type StatItem = {
  id: string;
  label: string;
  value: ReactNode;
  note?: string;
};

export function PageIntro({ eyebrow, title, description, actions, badges }: PageIntroProps) {
  return (
    <section className="page-hero">
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        {badges ? <div className="page-hero__badges">{badges}</div> : null}
      </div>
      {actions ? <div className="page-hero__actions">{actions}</div> : null}
    </section>
  );
}

export function StatCards({ items }: { items: StatItem[] }) {
  return (
    <div className="stats-grid">
      {items.map((item) => (
        <article key={item.id} className="metric-card">
          <span className="stat-label">{item.label}</span>
          <strong className="metric-card__value">{item.value}</strong>
          <p className="muted">{item.note || "No activity recorded yet."}</p>
        </article>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="theme-card">
      <div className="theme-card__header">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="theme-card__body">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M8 10h8M8 14h5" />
        </svg>
      </div>
      <div className="empty-state__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function InlineNotice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return <div className={`inline-notice inline-notice--${tone}`}>{children}</div>;
}
