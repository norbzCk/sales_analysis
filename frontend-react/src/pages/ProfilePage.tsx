import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { env } from "../config/env";
import { apiRequest } from "../lib/http";

interface ProfileState {
  name: string;
  email: string;
  phone: string;
  address: string;
  profile_photo: string;
}

interface PasswordState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

function getInitials(name?: string) {
  const text = String(name || "User").trim();
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileState>({ name: "", email: "", phone: "", address: "", profile_photo: "" });
  const [passwordDraft, setPasswordDraft] = useState<PasswordState>({ current_password: "", new_password: "", confirm_password: "" });
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      profile_photo: user?.profile_photo || "",
    });
  }, [user]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    try {
      const updated = await apiRequest<{
        name: string;
        email: string;
        phone?: string;
        address?: string;
        profile_photo?: string;
      }>("/auth/me", {
        method: "PUT",
        body: {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          profile_photo: profile.profile_photo || null,
        },
      });
      setProfile({
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        address: updated.address || "",
        profile_photo: updated.profile_photo || "",
      });
      await refreshUser();

      setEditing(false);
      setFlash("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFlash("");
    setPasswordUpdating(true);

    if (!passwordDraft.current_password || !passwordDraft.new_password || !passwordDraft.confirm_password) {
      setError("Fill all password fields to change password.");
      setPasswordUpdating(false);
      return;
    }
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setError("New passwords do not match.");
      setPasswordUpdating(false);
      return;
    }

    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: {
          current_password: passwordDraft.current_password,
          new_password: passwordDraft.new_password,
        },
      });
      setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
      setShowPasswordModal(false);
      setFlash("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPasswordUpdating(false);
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setFlash("");
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await apiRequest<{ image_url: string }>("/auth/upload-profile-photo", {
        method: "POST",
        body: form,
      });
      setProfile((state) => ({ ...state, profile_photo: response.image_url }));
      setFlash("Profile photo uploaded. Save profile to apply.");
      setShowPhotoModal(false); // Close modal after upload
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  if (user?.role !== "user") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="text-gray-600">The legacy profile screen is only available for customer accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Profile & Settings</p>
              <h1 className="text-3xl font-bold text-gray-900">Manage your account</h1>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}
        {flash && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">{flash}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-4 mb-6">
                {profile.profile_photo ? (
                  <img
                    src={resolveImageUrl(profile.profile_photo)}
                    alt={profile.name || "Profile"}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-teal-600 font-semibold text-lg">{getInitials(profile.name || "User")}</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">{profile.name || "User"}</h2>
                  <p className="text-gray-600">{user?.email}</p>
                  <button
                    className="mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    onClick={() => setShowPhotoModal(true)}
                  >
                    Change Photo
                  </button>
                </div>
              </div>

            </div>

            <form className="space-y-6" onSubmit={handleProfileSubmit}>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      value={profile.name}
                      onChange={(event) => setProfile((state) => ({ ...state, name: event.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      value={profile.email}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        value={profile.phone}
                        onChange={(event) => setProfile((state) => ({ ...state, phone: event.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        value={profile.address}
                        onChange={(event) => setProfile((state) => ({ ...state, address: event.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? "Processing..." : "Update Profile"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <form className="space-y-6" onSubmit={handlePasswordSubmit}>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Change Password</h2>
                  <p className="text-gray-600 text-sm mb-4">Keep your account secure with a strong password.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                      <div className="relative">
                        <input
                          type={showPassword.current ? "text" : "password"}
                          value={passwordDraft.current_password}
                          onChange={(event) => setPasswordDraft((prev) => ({ ...prev, current_password: event.target.value }))}
                          required
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                        >
                          <span className="text-gray-400">{showPassword.current ? "👁️" : "👁️‍🗨️"}</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                      <div className="relative">
                        <input
                          type={showPassword.new ? "text" : "password"}
                          minLength={8}
                          value={passwordDraft.new_password}
                          onChange={(event) => setPasswordDraft((prev) => ({ ...prev, new_password: event.target.value }))}
                          required
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                        >
                          <span className="text-gray-400">{showPassword.new ? "👁️" : "👁️‍🗨️"}</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                      <div className="relative">
                        <input
                          type={showPassword.confirm ? "text" : "password"}
                          minLength={8}
                          value={passwordDraft.confirm_password}
                          onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirm_password: event.target.value }))}
                          required
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                        >
                          <span className="text-gray-400">{showPassword.confirm ? "👁️" : "👁️‍🗨️"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                      type="submit"
                      disabled={passwordUpdating}
                    >
                      {passwordUpdating ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

      {/* Change Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Change Profile Photo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload new photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Or enter photo URL</label>
                <input
                  value={profile.profile_photo}
                  onChange={(event) => setProfile((state) => ({ ...state, profile_photo: event.target.value }))}
                  placeholder="/uploads/profile-photo.jpg or https://example.com/avatar.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {profile.profile_photo && (
                <div className="flex justify-center">
                  <img
                    src={resolveImageUrl(profile.profile_photo)}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setShowPhotoModal(false)}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? "Uploading..." : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
            </div>
            <form className="p-6 space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showPassword.current ? "text" : "password"}
                    value={passwordDraft.current_password}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, current_password: event.target.value }))}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(prev => ({...prev, current: !prev.current}))}
                  >
                    <span className="text-gray-400">{showPassword.current ? "👁️" : "👁️‍🗨️"}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showPassword.new ? "text" : "password"}
                    minLength={8}
                    value={passwordDraft.new_password}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, new_password: event.target.value }))}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(prev => ({...prev, new: !prev.new}))}
                  >
                    <span className="text-gray-400">{showPassword.new ? "👁️" : "👁️‍🗨️"}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? "text" : "password"}
                    minLength={8}
                    value={passwordDraft.confirm_password}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirm_password: event.target.value }))}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(prev => ({...prev, confirm: !prev.confirm}))}
                  >
                    <span className="text-gray-400">{showPassword.confirm ? "👁️" : "👁️‍🗨️"}</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={passwordUpdating}
                >
                  {passwordUpdating ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
