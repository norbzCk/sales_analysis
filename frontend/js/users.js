const table = document.getElementById("usersTable");
const form = document.getElementById("userForm");
const flash = document.getElementById("usersFlash");

let currentUser = null;

function showFlash(type, message) {
  flash.className = `flash show ${type}`;
  flash.textContent = message;
  setTimeout(() => flash.className = "flash", 2500);
}

function row(user) {
  return `
    <tr>
      <td>${user.id}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>${user.is_active ? "Active" : "Disabled"}</td>
    </tr>
  `;
}

async function loadUsers() {
  try {
    const users = await apiFetch("/auth/users");
    if (!users.length) {
      table.innerHTML = `<tr><td class="empty" colspan="5">No users found</td></tr>`;
      return;
    }
    table.innerHTML = users.map(row).join("");
  } catch (err) {
    table.innerHTML = `<tr><td class="empty" colspan="5">${err.message}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthPage();
  if (!currentUser || !(currentUser.role === "admin" || currentUser.role === "super_admin")) {
    window.location.href = "index.html";
    return;
  }

  if (currentUser.role !== "super_admin") {
    const roleSelect = document.getElementById("role");
    roleSelect.querySelector('option[value="super_admin"]').remove();
  }

  loadUsers();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
      role: document.getElementById("role").value,
    };

    try {
      await apiFetch("/auth/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      showFlash("success", "User created.");
      loadUsers();
    } catch (err) {
      showFlash("error", err.message);
    }
  });
});
