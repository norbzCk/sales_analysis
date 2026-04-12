import { Link } from "react-router-dom";
import logoUrl from "../assets/salesLOGO.png";

export function BrandMark({ to = "/", subtitle = "Global Commerce" }: { to?: string; subtitle?: string }) {
  return (
    <Link to={to} className="brand-mark">
      <img className="brand-mark-image" src={logoUrl} alt="Kariakoo Sales" />
      <div className="brand-mark-copy">
        <span className="brand-mark-title">Kariakoo Sales</span>
        <span className="brand-mark-subtitle">{subtitle}</span>
      </div>
    </Link>
  );
}
