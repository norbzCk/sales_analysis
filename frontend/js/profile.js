const profileFlash = document.getElementById("profileFlash");
const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");

function showFlash(type, message) {
  profileFlash.className = `flash show ${type}`;
  profileFlash.textContent = message;
  setTimeout(() => {
    profileFlash.className = "flash";
  }, 2500);
}

function fillProfile(user) {
  document.getElementById("profileName").value = user.name || "";
  document.getElementById("profileEmail").value = user.email || "";
  document.getElementById("profilePhone").value = user.phone || "";
  document.getElementById("profileAddress").value = user.address || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user) return;
  if (user.role !== "user") {
    redirectToPostLogin(user);
    return;
  }

  fillProfile(user);

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("profileName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      address: document.getElementById("profileAddress").value.trim(),
    };

    try {
      const updated = await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      localStorage.setItem("session_user", JSON.stringify(updated));
      fillProfile(updated);
      applyUserToUi(updated);
      showFlash("success", "Profile updated.");
    } catch (err) {
      showFlash("error", err.message);
    }
  });

  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword.length < 8) {
      showFlash("error", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showFlash("error", "New passwords do not match.");
      return;
    }

    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      passwordForm.reset();
      showFlash("success", "Password changed.");
    } catch (err) {
      showFlash("error", err.message);
    }
  });
});
