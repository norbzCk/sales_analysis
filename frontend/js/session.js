window.API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("access_token");
}

function setSession(token, user) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("session_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("session_user");
}

function logout() {
  clearSession();
  window.location.href = "login.html";
}

function hasAdminAccess(role) {
  return role === "admin" || role === "super_admin";
}

function roleLabel(role) {
  if (role === "super_admin") return "owner";
  if (role === "admin") return "admin";
  return "customer";
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${window.API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch (_e) {
      detail = await response.text() || detail;
    }
    throw new Error(detail);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function requireAuthPage() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return null;
  }
  const user = await apiFetch("/auth/me");
  localStorage.setItem("session_user", JSON.stringify(user));
  applyUserToUi(user);
  return user;
}

function applyUserToUi(user) {
  const label = document.getElementById("currentUserLabel");
  if (label && user) {
    label.textContent = `${user.name} (${roleLabel(user.role)})`;
  }

  const adminOnly = document.querySelectorAll('[data-role-min="admin"]');
  adminOnly.forEach((el) => {
    if (!hasAdminAccess(user.role)) {
      el.style.display = "none";
    }
  });

  const superOnly = document.querySelectorAll('[data-role-min="super_admin"]');
  superOnly.forEach((el) => {
    if (user.role !== "super_admin") {
      el.style.display = "none";
    }
  });

  const roleOnly = document.querySelectorAll("[data-role-only]");
  roleOnly.forEach((el) => {
    const allowed = (el.dataset.roleOnly || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(user.role)) {
      el.style.display = "none";
    }
  });

  const roleExcept = document.querySelectorAll("[data-role-except]");
  roleExcept.forEach((el) => {
    const blocked = (el.dataset.roleExcept || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (blocked.includes(user.role)) {
      el.style.display = "none";
    }
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
}
