import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type { Order, PaymentHistoryItem, PaymentMethod, PaymentResponse } from "../types/domain";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

export function PaymentsPage() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (user?.role === "user") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      const [methodsData, orderData, historyData] = await Promise.all([
        apiRequest<{ payment_methods: PaymentMethod[] }>("/payments/methods"),
        apiRequest<Order[]>("/orders/"),
        apiRequest<{ payments: PaymentHistoryItem[] }>("/payments/history"),
      ]);
      setMethods(methodsData.payment_methods || []);
      setOrders(orderData);
      setHistory(historyData.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderId = Number(form.get("order_id"));
    const amount = Number(form.get("amount"));
    const method = String(form.get("payment_method") || "");
    const phone = String(form.get("phone_number") || "").trim();

    try {
      const response = ["mpesa", "airtel_money", "tigopesa"].includes(method)
        ? await apiRequest<PaymentResponse>(`/payments/mobile-money/stk-push?phone_number=${encodeURIComponent(phone)}&amount=${amount}&order_id=${orderId}&provider=${encodeURIComponent(method)}`, { method: "POST" })
        : await apiRequest<PaymentResponse>("/payments/initiate", {
            method: "POST",
            body: { order_id: orderId, amount, payment_method: method, phone_number: phone || null },
          });
      setResult(response);
      setFlash("Payment initiated.");
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment");
    }
  }

  if (user?.role !== "user") {
    return <section className="panel"><h1>Payments</h1><p className="muted">Payments are only available in the customer flow.</p></section>;
  }

  return (
    <section className="panel-stack">
      <div className="panel"><p className="eyebrow">Payments</p><h1>Pay for orders and view payment history</h1></div>
      {error ? <p className="alert error">{error}</p> : null}
      {flash ? <p className="alert success">{flash}</p> : null}

      <div className="two-column-grid">
        <div className="panel stack-list">
          <h2>Payment methods</h2>
          {methods.map((method) => (
            <div key={method.id} className="list-card">
              <div>
                <strong>{method.name}</strong>
                <p>{method.instructions || ""}</p>
              </div>
              <span>{method.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          ))}
        </div>

        <form className="panel form-grid" onSubmit={handleSubmit}>
          <h2>Initiate payment</h2>
          <label>
            Order
            <select name="order_id" required>
              <option value="">Select order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>#{order.id} {order.product} - {formatMoney(order.total || Number(order.unit_price || 0) * Number(order.quantity || 0))}</option>
              ))}
            </select>
          </label>
          <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>
            Method
            <select name="payment_method" required>
              <option value="">Select method</option>
              {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
          </label>
          <label>Phone number<input name="phone_number" /></label>
          <button className="primary-button" type="submit">Initiate payment</button>
          {result ? (
            <div className="alert success">
              <strong>{result.transaction_id}</strong>
              <p>{result.message}</p>
              <p>{formatMoney(result.amount)}</p>
            </div>
          ) : null}
        </form>
      </div>

      <div className="panel table-scroll">
        <h2>Payment history</h2>
        <table className="data-table">
          <thead><tr><th>Transaction</th><th>Order</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {!history.length ? <tr><td colSpan={6}>No payment history yet.</td></tr> : null}
            {history.map((item) => (
              <tr key={item.transaction_id}>
                <td>{item.transaction_id}</td>
                <td>#{item.order_id}</td>
                <td>{item.product || "-"}</td>
                <td>{formatMoney(item.amount)}</td>
                <td>{item.status}</td>
                <td>{item.date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
