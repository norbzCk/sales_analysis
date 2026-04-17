const profileFlash = document.getElementById("profileFlash");
const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");
const photoInput = document.getElementById("profilePhotoInput");
const photoPreview = document.getElementById("profilePhotoPreview");

function showFlash(type, message) {
  profileFlash.className = `flash show ${type}`;
  profileFlash.textContent = message;
  setTimeout(() => {
    profileFlash.className = "flash";
  }, 2500);
}

function fillProfile(user) {
  document.getElementById("profileName").value = user.name || user.owner_name || "";
  document.getElementById("profileEmail").value = user.email || "";
  document.getElementById("profilePhone").value = user.phone || "";
  document.getElementById("profileAddress").value = user.address || user.street || "";
  
  document.getElementById("userNameDisplay").textContent = user.name || user.business_name || "User";
  document.getElementById("userRoleDisplay").textContent = user.role === "user" ? "Customer" : user.role.replace("_", " ").toUpperCase();
  
  const businessSection = document.getElementById("businessSettingsSection");
  if (user.role === "seller" && businessSection) {
    businessSection.style.display = "block";
    document.getElementById("autoConfirmToggle").checked = !!user.auto_confirm;
  }

  if (user.profile_photo) {
    photoPreview.src = user.profile_photo.startsWith("http") ? user.profile_photo : `${window.API_BASE}${user.profile_photo}`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthPage();
  if (!user) return;

  fillProfile(user);

  // Tab switching
  const navItems = document.querySelectorAll(".profile-nav-new .nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const target = item.dataset.target;
      navItems.forEach(i => i.classList.remove("active"));
      tabContents.forEach(t => t.classList.remove("active"));
      
      item.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });

  // Photo Upload
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const endpoint = user.role === "seller" ? "/business/upload-profile-photo" : "/auth/upload-profile-photo";
      const token = getToken();
      const response = await fetch(`${window.API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      
      // Update profile with new photo URL
      await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ profile_photo: data.image_url })
      });

      photoPreview.src = `${window.API_BASE}${data.image_url}`;
      showFlash("success", "Photo updated successfully");
    } catch (err) {
      showFlash("error", err.message);
    }
  });

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("profileName").value.trim(),
      owner_name: document.getElementById("profileName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      address: document.getElementById("profileAddress").value.trim(),
      street: document.getElementById("profileAddress").value.trim(),
    };

    if (user.role === "seller") {
      payload.auto_confirm = document.getElementById("autoConfirmToggle").checked;
    }

    try {
      const endpoint = user.role === "seller" ? "/business/me" : "/auth/me";
      const updated = await apiFetch(endpoint, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const userData = updated.user || updated;
      localStorage.setItem("session_user", JSON.stringify(userData));
      fillProfile(userData);
      applyUserToUi(userData);
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
