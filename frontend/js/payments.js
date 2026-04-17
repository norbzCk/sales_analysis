const paymentsTable = document.getElementById("paymentHistoryTable");
const paymentForm = document.getElementById("paymentForm");
const paymentResult = document.getElementById("paymentResult");
const methodSelect = document.getElementById("paymentMethodSelect");
const phoneInput = document.getElementById("paymentPhone");
const flash = document.getElementById("paymentFlash");
const orderSelect = document.getElementById("paymentOrderId");
const amountInput = document.getElementById("paymentAmount");
const instructionPanel = document.getElementById("paymentInstructions");
const instructionText = document.getElementById("instructionText");

let confirmedOrders = [];
let availableMethods = [];

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function showFlash(type, message) {
  if (!flash) return;
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => {
    flash.className = "flash";
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPaymentRow(payment) {
  return `
    <tr>
      <td><code>${escapeHtml(payment.transaction_id)}</code></td>
      <td>#${payment.order_id}</td>
      <td>${escapeHtml(payment.product || "-")}</td>
      <td>${formatMoney(payment.amount)}</td>
      <td>${escapeHtml(payment.payment_method || "-")}</td>
      <td><span class="badge">${escapeHtml(payment.status)}</span></td>
      <td>${payment.date ? new Date(payment.date).toLocaleDateString() : "-"}</td>
    </tr>
  `;
}

async function loadPaymentMethods() {
  try {
    const data = await apiFetch("/payments/methods");
    availableMethods = data.payment_methods || [];
    if (methodSelect) {
      methodSelect.innerHTML = '<option value="">Select payment method</option>' +
        availableMethods.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    }
  } catch (err) {
    console.error("Failed to load payment methods:", err);
  }
}

async function loadConfirmedOrders() {
  try {
    const orders = await apiFetch("/orders/");
    confirmedOrders = orders.filter(o => o.status === "Confirmed");

    if (orderSelect) {
      orderSelect.innerHTML = '<option value="">Choose a confirmed order</option>' +
        confirmedOrders.map(o => `<option value="${o.id}">${escapeHtml(o.product)} (#${o.id}) - ${formatMoney(o.total)}</option>`).join("");
    }

    // Summary stats
    const totalValue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const paidOrders = orders.filter(o => ["Shipped", "Received"].includes(o.status));
    const paidAmount = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    if (document.getElementById("payTotalValue")) document.getElementById("payTotalValue").textContent = formatMoney(totalValue);
    if (document.getElementById("payPaidAmount")) document.getElementById("payPaidAmount").textContent = formatMoney(paidAmount);
    if (document.getElementById("payBalance")) document.getElementById("payBalance").textContent = formatMoney(totalValue - paidAmount);
    if (document.getElementById("payPaidOrders")) document.getElementById("payPaidOrders").textContent = paidOrders.length;

  } catch (err) {
    console.error("Failed to load orders:", err);
  }
}

async function loadPaymentHistory() {
  if (!paymentsTable) return;
  try {
    const data = await apiFetch("/payments/history");
    const payments = data.payments || [];
    if (!payments.length) {
      paymentsTable.innerHTML = '<tr><td class="empty" colspan="7">No payment history yet</td></tr>';
      return;
    }
    paymentsTable.innerHTML = payments.map(renderPaymentRow).join("");
  } catch (err) {
    paymentsTable.innerHTML = `<tr><td class="empty" colspan="7">${err.message}</td></tr>`;
  }
}

if (orderSelect) {
  orderSelect.addEventListener("change", () => {
    const order = confirmedOrders.find(o => o.id == orderSelect.value);
    if (order) {
      amountInput.value = order.total;
    } else {
      amountInput.value = "";
    }
  });
}

if (methodSelect) {
  methodSelect.addEventListener("change", () => {
    const method = availableMethods.find(m => m.id === methodSelect.value);
    const isMobileMoney = ["mpesa", "airtel_money", "tigopesa"].includes(methodSelect.value);

    phoneInput.style.display = isMobileMoney ? "block" : "none";

    if (method && method.instructions) {
      instructionPanel.style.display = "block";
      instructionText.textContent = method.instructions;
    } else {
      instructionPanel.style.display = "none";
    }
  });
}

if (paymentForm) {
  paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderId = orderSelect.value;
    const amount = amountInput.value;
    const method = methodSelect.value;
    const phone = phoneInput.value;

    if (!orderId || !method) return;

    try {
      let response;
      if (["mpesa", "airtel_money", "tigopesa"].includes(method)) {
        response = await apiFetch("/payments/mobile-money/stk-push", {
          method: "POST",
          body: JSON.stringify({
            phone_number: phone,
            amount: parseFloat(amount),
            order_id: parseInt(orderId),
            provider: method
          })
        });
      } else {
        response = await apiFetch("/payments/initiate", {
          method: "POST",
          body: JSON.stringify({
            order_id: parseInt(orderId),
            amount: parseFloat(amount),
            payment_method: method,
            phone_number: phone || null
          })
        });
      }

      showFlash("success", "Payment successful! Order is now being processed.");
      paymentForm.reset();
      instructionPanel.style.display = "none";
      await loadConfirmedOrders();
      await loadPaymentHistory();

      if (paymentResult) {
        paymentResult.innerHTML = `
          <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-top: 16px; border: 1px solid #bcf0da;">
            <p style="color: #166534; font-weight: 700;">Transaction ID: ${response.transaction_id}</p>
            <p style="color: #166534; font-size: 0.9rem;">Status: ${response.status}</p>
          </div>
        `;
      }
    } catch (err) {
      showFlash("error", err.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user || user.role !== "user") return;

  await loadPaymentMethods();
  await loadConfirmedOrders();
  await loadPaymentHistory();
});