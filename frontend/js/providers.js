const table = document.getElementById("providerTable");
const form = document.getElementById("providerForm");
const flash = document.getElementById("providerFlash");

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => {
    flash.className = "flash";
  }, 2500);
}

function verifiedBadge(value) {
  return value
    ? '<span class="badge badge-verified">Verified</span>'
    : '<span class="badge badge-muted">Pending</span>';
}

function row(provider) {
  return `
    <tr>
      <td>${provider.name ?? "-"}</td>
      <td>${provider.location ?? "-"}</td>
      <td>${provider.email ?? "-"}</td>
      <td>${provider.phone ?? "-"}</td>
      <td>${verifiedBadge(provider.verified)}</td>
      <td>${provider.response_time ?? "-"}</td>
      <td>${provider.min_order_qty ?? "-"}</td>
      <td>
        <button class="btn btn-danger" data-delete-id="${provider.id}">Delete</button>
      </td>
    </tr>
  `;
}

async function loadProviders() {
  try {
    const data = await apiFetch("/providers/");
    if (!data.length) {
      table.innerHTML = '<tr><td class="empty" colspan="8">No providers added yet</td></tr>';
      return;
    }
    table.innerHTML = data.map(row).join("");

    table.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.deleteId);
        if (!confirm("Delete this provider?")) return;
        await deleteProvider(id);
      });
    });
  } catch (err) {
    table.innerHTML = `<tr><td class="empty" colspan="8">${err.message}</td></tr>`;
  }
}

async function deleteProvider(id) {
  try {
    await apiFetch(`/providers/${id}`, { method: "DELETE" });
    showFlash("success", "Provider deleted.");
    loadProviders();
  } catch (err) {
    showFlash("error", err.message);
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("providerName").value.trim(),
    location: document.getElementById("providerLocation").value.trim() || null,
    email: document.getElementById("providerEmail").value.trim() || null,
    phone: document.getElementById("providerPhone").value.trim() || null,
    response_time: document.getElementById("providerResponse").value.trim() || null,
    min_order_qty: document.getElementById("providerMOQ").value.trim() || null,
    verified: document.getElementById("providerVerified").checked,
  };

  if (!payload.name) {
    showFlash("error", "Provider name is required.");
    return;
  }

  try {
    await apiFetch("/providers/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    showFlash("success", "Provider saved.");
    loadProviders();
  } catch (err) {
    showFlash("error", err.message);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await requireAuthPage();
  if (!currentUser || !hasAdminAccess(currentUser.role)) {
    if (currentUser) {
      redirectToPostLogin(currentUser);
    } else {
      window.location.href = "login.html";
    }
    return;
  }
  loadProviders();
});
