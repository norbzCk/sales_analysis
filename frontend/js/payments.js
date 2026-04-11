const paymentsTable = document.getElementById("paymentsTable") || document.getElementById("paymentHistoryTable");
const paymentMethodsDiv = document.getElementById("paymentMethods");
const paymentForm = document.getElementById("paymentForm");
const paymentResult = document.getElementById("paymentResult");
const methodSelect = document.getElementById("paymentMethodSelect");
const phoneInput = document.getElementById("paymentPhone");
const flash = document.getElementById("paymentFlash");

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

function statusFromOrder(order) {
  const status = String(order.status || "").trim();
  if (status === "Received" || status === "Delivered") return "Paid";
  if (status === "Cancelled") return "Cancelled";
  return "Pending";
}

function renderPaymentMethodCard(method) {
  const icons = {
    mpesa: "📱",
    airtel_money: "📱",
    tigopesa: "📱",
    bank_transfer: "🏦",
    cash: "💵",
    credit: "💳"
  };
  const icon = icons[method.id] || "💰";
  return `
    <article class="payment-method-card">
      <div class="payment-method-icon">${icon}</div>
      <div class="payment-method-info">
        <h4>${escapeHtml(method.name)}</h4>
        <p class="muted">${escapeHtml(method.instructions || "")}</p>
      </div>
    </article>
  `;
}

function renderPaymentRow(payment) {
  return `
    <tr>
      <td><code>${escapeHtml(payment.transaction_id)}</code></td>
      <td>#${payment.order_id}</td>
      <td>${escapeHtml(payment.product || "-")}</td>
      <td>${formatMoney(payment.amount)}</td>
      <td><span class="badge">${escapeHtml(payment.status)}</span></td>
      <td>${payment.date || "-"}</td>
    </tr>
  `;
}

function row(order) {
  const paymentStatus = statusFromOrder(order);
  const total = Number(order.unit_price || 0) * Number(order.quantity || 0);
  return `
    <tr>
      <td>#${order.id}</td>
      <td>${order.order_date ?? "-"}</td>
      <td>${order.product ?? "-"}</td>
      <td>${formatMoney(total)}</td>
      <td><span class="badge">${paymentStatus}</span></td>
    </tr>
  `;
}

async function loadPaymentMethods() {
  try {
    const data = await apiFetch("/payments/methods");
    const methods = data.payment_methods || [];
    
    if (paymentMethodsDiv) {
      paymentMethodsDiv.innerHTML = methods.map(renderPaymentMethodCard).join("");
    }
    
    if (methodSelect) {
      methodSelect.innerHTML = '<option value="">Select payment method</option>' +
        methods.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    }
  } catch (err) {
    console.error("Failed to load payment methods:", err);
  }
}

async function loadPayments() {
  const data = await apiFetch("/orders/");
  const orders = Array.isArray(data) ? data : [];

  const total = orders.reduce((sum, o) => {
    const oTotal = Number(o.unit_price || 0) * Number(o.quantity || 0);
    return sum + oTotal;
  }, 0);
  const paidAmount = orders.reduce((sum, o) => sum + (statusFromOrder(o) === "Paid" ? Number(o.unit_price || 0) * Number(o.quantity || 0) : 0), 0);
  const paidOrders = orders.filter((o) => statusFromOrder(o) === "Paid").length;
  const balance = Math.max(0, total - paidAmount);

  const totalEl = document.getElementById("payTotalValue");
  const paidEl = document.getElementById("payPaidAmount");
  const balanceEl = document.getElementById("payBalance");
  const ordersEl = document.getElementById("payPaidOrders");

  if (totalEl) totalEl.textContent = formatMoney(total);
  if (paidEl) paidEl.textContent = formatMoney(paidAmount);
  if (balanceEl) balanceEl.textContent = formatMoney(balance);
  if (ordersEl) ordersEl.textContent = String(paidOrders);

  if (paymentsTable) {
    if (!orders.length) {
      paymentsTable.innerHTML = '<tr><td class="empty" colspan="5">No payment history yet</td></tr>';
      return;
    }
    paymentsTable.innerHTML = orders.map(row).join("");
  }
}

async function loadPaymentHistory() {
  if (!paymentsTable) return;
  try {
    const data = await apiFetch("/payments/history");
    const payments = data.payments || [];
    if (!payments.length) {
      paymentsTable.innerHTML = '<tr><td class="empty" colspan="6">No payment history yet</td></tr>';
      return;
    }
    paymentsTable.innerHTML = payments.map(renderPaymentRow).join("");
  } catch (err) {
    console.error("Failed to load payment history:", err);
  }
}

if (methodSelect) {
  methodSelect.addEventListener("change", () => {
    const selected = methodSelect.value;
    const isMobileMoney = ["mpesa", "airtel_money", "tigopesa"].includes(selected);
    phoneInput.style.display = isMobileMoney ? "block" : "none";
  });
}

if (paymentForm) {
  paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById("paymentOrderId").value;
    const amount = document.getElementById("paymentAmount").value;
    const method = document.getElementById("paymentMethodSelect").value;
    const phone = document.getElementById("paymentPhone").value;
    
    if (!orderId || !amount || !method) {
      showFlash("error", "Please fill all required fields");
      return;
    }
    
    try {
      let response;
      
      if (["mpesa", "airtel_money", "tigopesa"].includes(method)) {
        if (!phone) {
          showFlash("error", "Phone number required for mobile money");
          return;
        }
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
      
      if (paymentResult) {
        paymentResult.innerHTML = `
          <div class="payment-success">
            <h4>Payment Initiated</h4>
            <p><strong>Transaction ID:</strong> <code>${escapeHtml(response.transaction_id)}</code></p>
            <p><strong>Amount:</strong> ${formatMoney(response.amount)}</p>
            <p class="muted">${escapeHtml(response.message)}</p>
            ${response.instructions ? `<p class="muted"><strong>Instructions:</strong> ${escapeHtml(response.instructions)}</p>` : ""}
          </div>
        `;
      }
      
      showFlash("success", "Payment initiated successfully");
      paymentForm.reset();
      
    } catch (err) {
      showFlash("error", err.message);
      if (paymentResult) {
        paymentResult.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user) return;
  if (user.role !== "user") {
    redirectToPostLogin(user);
    return;
  }

  try {
    await loadPaymentMethods();
    await loadPayments();
    await loadPaymentHistory();
  } catch (err) {
    if (paymentsTable) {
      paymentsTable.innerHTML = `<tr><td class="empty" colspan="5">${err.message}</td></tr>`;
    }
  }
});