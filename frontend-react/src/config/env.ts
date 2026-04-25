function resolveDefaultApiBase() {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const { hostname, origin, protocol } = window.location;
  
  // If we are running in dev mode with Vite proxy, use current origin
  // Vite config proxies specific paths to 127.0.0.1:8000
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return origin; 
  }

  if (protocol === "https:" && hostname.endsWith("netlify.app")) {
    return "https://sales-analysis-api.onrender.com";
  }

  return origin.replace(/\/+$/, "");
}

export const env = {
  apiBase: (import.meta.env.VITE_API_BASE || resolveDefaultApiBase()).replace(/\/+$/, ""),
};
