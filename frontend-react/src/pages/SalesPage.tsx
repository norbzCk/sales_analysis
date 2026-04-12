import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { Sale } from "../types/domain";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

export function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (["super_admin", "owner"].includes(String(user?.role || ""))) {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      const data = await apiRequest<Sale[]>("/sales/");
      setSales(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      date: String(form.get("date") || ""),
      product: String(form.get("product") || "").trim(),
      category: String(form.get("category") || "").trim(),
      quantity: Number(form.get("quantity") || 0),
      unit_price: Number(form.get("unit_price") || 0),
    };
    try {
      await apiRequest("/sales/", { method: "POST", body: payload });
      event.currentTarget.reset();
      setFlash("Sale saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sale");
    }
  }

  if (!["super_admin", "owner"].includes(String(user?.role || ""))) {
    return <section className="panel"><h1>Sales</h1><p className="muted">Only owner and super admin accounts can record sales.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Sales</p><h1>Sales records</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        <label>Product<input name="product" required /></label>
        <label>Category<input name="category" required /></label>
        <label>Quantity<input name="quantity" type="number" min="1" required /></label>
        <label>Unit price<input name="unit_price" type="number" min="0" step="0.01" required /></label>
        <button className="primary-button" type="submit">Save sale</button>
      </form>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Quantity</th><th>Unit price</th><th>Revenue</th></tr></thead>
          <tbody>
            {!sales.length ? <tr><td colSpan={6}>No sales recorded yet.</td></tr> : null}
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.date || "-"}</td>
                <td>{sale.product || "-"}</td>
                <td>{sale.category || "-"}</td>
                <td>{sale.quantity || 0}</td>
                <td>{formatMoney(sale.unit_price)}</td>
                <td>{formatMoney(sale.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
