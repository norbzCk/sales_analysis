const form = document.getElementById("loginForm");
const flash = document.getElementById("loginFlash");

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
  };

  try {
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
    window.location.href = "index.html";
  } catch (err) {
    showFlash("error", err.message || "Login failed");
  }
});
