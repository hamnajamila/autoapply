import axios from "axios";

function resolveApiBaseUrl() {
  const configuredUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  try {
    const parsedUrl = new URL(configuredUrl);
    const browserHost = window.location.hostname;
    const isLocalHost = ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
    const isBrowserLocalHost = ["localhost", "127.0.0.1"].includes(browserHost);

    if (isLocalHost && isBrowserLocalHost) {
      parsedUrl.hostname = browserHost;
      return parsedUrl.toString().replace(/\/$/, "");
    }

    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return configuredUrl;
  }
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true
});

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("autoapply_token");
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("autoapply_token");
      if (window.location.pathname.startsWith("/dashboard")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

