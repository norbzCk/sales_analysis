const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export const env = {
  apiBase: import.meta.env.VITE_API_BASE || DEFAULT_API_BASE,
};
