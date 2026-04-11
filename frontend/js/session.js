window.API_BASE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE) || "http://127.0.0.1:8000";

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "customer") return "user";
  if (role === "business") return "seller";
  return role;
}

function normalizeUser(user, fallbackType = "") {
  if (!user || typeof user !== "object") return user;
  const next = { ...user };
  if (!next.role && fallbackType) {
    next.role = fallbackType === "business" ? "seller" : fallbackType;
  }
  if (next.role) next.role = normalizeRole(next.role);
  return next;
}

function getToken() {
  return localStorage.getItem("access_token");
}

function setUserType(userType) {
  if (!userType) return;
  localStorage.setItem("user_type", userType);
}

function setSession(token, user, userType = "") {
  const normalized = normalizeUser(user, userType);
  localStorage.setItem("access_token", token);
  localStorage.setItem("session_user", JSON.stringify(normalized || {}));
  if (userType) {
    localStorage.setItem("user_type", userType);
  }
  if (userType === "business") {
    localStorage.setItem("business_user", JSON.stringify(normalized || {}));
  }
  if (userType === "logistics") {
    localStorage.setItem("logistics_user", JSON.stringify(normalized || {}));
  }
  if (normalized?.role) {
    localStorage.setItem("user_role", normalized.role);
  }
}

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("session_user");
  localStorage.removeItem("user_type");
  localStorage.removeItem("user_role");
  localStorage.removeItem("business_user");
  localStorage.removeItem("logistics_user");
}

function logout() {
  clearSession();
  window.location.href = "home.html";
}

function getPostLoginPath(user) {
  const userType = (localStorage.getItem("user_type") || "").toLowerCase();
  const role = normalizeRole(user?.role || "");
  if (userType === "logistics" || role === "logistics") return "logistics-dashboard.html";
  if (userType === "business" || role === "seller" || hasAdminAccess(role)) return "index.html";
  return "customer-dashboard.html";
}

function redirectToPostLogin(user) {
  window.location.href = getPostLoginPath(user);
}

function hasAdminAccess(role) {
  const normalized = normalizeRole(role);
  return ["admin", "super_admin", "owner", "seller"].includes(normalized);
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

  const userType = (localStorage.getItem("user_type") || "").toLowerCase();

  // Business and logistics accounts use dedicated profile endpoints.
  if (userType === "business") {
    try {
      const user = await apiFetch("/business/me");
      const normalized = normalizeUser(user, "business");
      setSession(token, normalized, "business");
      applyUserToUi(normalized);
      return normalized;
    } catch (_err) {
      clearSession();
      window.location.href = "login.html";
      return null;
    }
  }

  if (userType === "logistics") {
    try {
      const user = await apiFetch("/logistics/me");
      const normalized = normalizeUser(user, "logistics");
      setSession(token, normalized, "logistics");
      applyUserToUi(normalized);
      return normalized;
    } catch (_err) {
      clearSession();
      window.location.href = "login.html";
      return null;
    }
  }

  // Default to the core auth endpoint for customer/admin accounts.
  try {
    const user = await apiFetch("/auth/me");
    const normalized = normalizeUser(user, "user");
    setSession(token, normalized, "user");
    applyUserToUi(normalized);
    return normalized;
  } catch (err) {
    // If that fails, check for session user
    const sessionUser = localStorage.getItem("session_user");
    if (sessionUser) {
      const user = normalizeUser(JSON.parse(sessionUser), userType || "user");
      applyUserToUi(user);
      return user;
    }
    // No valid user found, redirect to login
    clearSession();
    window.location.href = "login.html";
    return null;
  }
}

function applyUserToUi(user) {
  if (!user) return;
  
  const label = document.getElementById("currentUserLabel");
  if (label && user) {
    const displayName = user.business_name || user.name || user.owner_name || user.phone || "User";
    label.textContent = displayName;
  }

  const adminOnly = document.querySelectorAll('[data-role-min="admin"]');
  adminOnly.forEach((el) => {
    if (!hasAdminAccess(user.role)) {
      el.style.display = "none";
    }
  });

  const superOnly = document.querySelectorAll('[data-role-min="super_admin"]');
  superOnly.forEach((el) => {
    if (!(["super_admin", "owner"].includes(normalizeRole(user.role)))) {
      el.style.display = "none";
    }
  });

  const roleOnly = document.querySelectorAll("[data-role-only]");
  roleOnly.forEach((el) => {
    const allowed = (el.dataset.roleOnly || "").split(",").map((item) => item.trim()).filter(Boolean);
    const role = normalizeRole(user.role);
    if (allowed.length && !allowed.includes(role)) {
      el.style.display = "none";
    }
  });

  const roleExcept = document.querySelectorAll("[data-role-except]");
  roleExcept.forEach((el) => {
    const blocked = (el.dataset.roleExcept || "").split(",").map((item) => item.trim()).filter(Boolean);
    const role = normalizeRole(user.role);
    if (blocked.includes(role)) {
      el.style.display = "none";
    }
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
}
