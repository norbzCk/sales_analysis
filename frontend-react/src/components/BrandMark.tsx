import { Link } from "react-router-dom";
import logoUrl from "../assets/sokolink-logo.png";

export function BrandMark({ to = "/", subtitle = "Smart marketplace operations" }: { to?: string; subtitle?: string }) {
  return (
    <Link to={to} className="brand-mark">
      <div className="brand-mark-logo-container">
        <img className="brand-mark-image" src={logoUrl} alt="SokoLnk" />
      </div>
      <div className="brand-mark-copy">
        <span className="brand-mark-title">SokoLnk</span>
        <span className="brand-mark-subtitle">{subtitle}</span>
      </div>
    </Link>
  );
}
