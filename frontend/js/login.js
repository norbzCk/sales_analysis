const authCard = document.getElementById("authCard");
const tabButtons = Array.from(document.querySelectorAll(".auth-tab"));
const panels = Array.from(document.querySelectorAll(".auth-panel"));

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginFlash = document.getElementById("loginFlash");
const registerFlash = document.getElementById("registerFlash");

function showFlash(target, type, message) {
  if (!target) return;
  target.className = `flash show ${type}`;
  target.textContent = message;
}

function clearFlash(target) {
  if (!target) return;
  target.className = "flash";
  target.textContent = "";
}

function activateTab(mode) {
  authCard?.setAttribute("data-mode", mode);

  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isVisible = panel.dataset.mode === mode;
    panel.classList.toggle("active", isVisible);
  });

  clearFlash(loginFlash);
  clearFlash(registerFlash);
}

function setButtonLoading(button, isLoading, loadingLabel, idleLabel) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingLabel : idleLabel;
}

function emailLooksValid(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function passwordChecks(password) {
  const lengthOk = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return {
    valid: lengthOk && hasLetter && hasNumber,
    message: !lengthOk
      ? "Password must be at least 8 characters."
      : !hasLetter || !hasNumber
      ? "Password must include at least one letter and one number."
      : "",
  };
}

function redirectIfAuthenticated() {
  const token = getToken();
  if (!token) return;

  apiFetch("/auth/me")
    .then((user) => {
      redirectToPostLogin(user);
    })
    .catch(() => {
      clearSession();
    });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.mode));
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFlash(loginFlash);

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const payload = {
    email: document.getElementById("email").value.trim().toLowerCase(),
    password: document.getElementById("password").value,
  };

  if (!emailLooksValid(payload.email)) {
    showFlash(loginFlash, "error", "Enter a valid email address.");
    return;
  }

  if (!payload.password) {
    showFlash(loginFlash, "error", "Enter your password.");
    return;
  }

  try {
    setButtonLoading(submitBtn, true, "Signing In...", "Sign In");
    const res = await fetch(`${window.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();
    setSession(data.access_token, data.user);
    redirectToPostLogin(data.user);
  } catch (err) {
    showFlash(loginFlash, "error", err.message || "Login failed");
  } finally {
    setButtonLoading(submitBtn, false, "Signing In...", "Sign In");
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFlash(registerFlash);

  const submitBtn = registerForm.querySelector('button[type="submit"]');
  const payload = {
    name: document.getElementById("registerName").value.trim(),
    email: document.getElementById("registerEmail").value.trim().toLowerCase(),
    password: document.getElementById("registerPassword").value,
    confirmPassword: document.getElementById("registerConfirmPassword").value,
  };

  if (payload.name.length < 2) {
    showFlash(registerFlash, "error", "Name must be at least 2 characters.");
    return;
  }

  if (!emailLooksValid(payload.email)) {
    showFlash(registerFlash, "error", "Enter a valid email address.");
    return;
  }

  const passCheck = passwordChecks(payload.password);
  if (!passCheck.valid) {
    showFlash(registerFlash, "error", passCheck.message);
    return;
  }

  if (payload.password !== payload.confirmPassword) {
    showFlash(registerFlash, "error", "Passwords do not match.");
    return;
  }

  try {
    setButtonLoading(submitBtn, true, "Creating Account...", "Create Account");
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    });

    registerForm.reset();
    showFlash(registerFlash, "success", "Account created. Please sign in.");
    activateTab("login");
    document.getElementById("email").value = payload.email;
    document.getElementById("password").focus();
  } catch (err) {
    showFlash(registerFlash, "error", err.message || "Registration failed");
  } finally {
    setButtonLoading(submitBtn, false, "Creating Account...", "Create Account");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const initialMode = new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login";
  activateTab(initialMode);
  redirectIfAuthenticated();
});
