import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function AuthScene({
  eyebrow,
  title,
  description,
  bullets,
  links,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  links: Array<{ to: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <div className="auth-page auth-page-branded">
      <section className="auth-shell auth-shell-branded">
        <aside className="auth-story">
          <BrandMark subtitle="Dar es Salaam Marketplace" />
          <div className="auth-story-copy">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="auth-story-text">{description}</p>
          </div>

          <div className="auth-story-panel">
            <h2>Why teams use Kariakoo</h2>
            <ul className="auth-story-list">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="auth-links auth-links-branded">
            {links.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <div className="auth-card auth-card-branded">{children}</div>
      </section>
    </div>
  );
}
