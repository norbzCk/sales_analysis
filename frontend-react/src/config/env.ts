function resolveDefaultApiBase() {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const { hostname, origin, protocol } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1"]);

  if (localHosts.has(hostname)) {
    return "http://localhost:8000";
  }

  if (protocol === "https:" && hostname.endsWith("netlify.app")) {
    return "https://sales-analysis-api.onrender.com";
  }

  return origin.replace(/\/+$/, "");
}

export const env = {
  apiBase: (import.meta.env.VITE_API_BASE || resolveDefaultApiBase()).replace(/\/+$/, ""),
};
