import axios from "axios";
import { clearStoredAuthToken, getUsableStoredAuthToken } from "./auth-client";

export function getApiBaseUrl() {
  const configuredUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "/api-proxy";

  if (typeof window === "undefined") {
    if (configuredUrl.startsWith("/")) {
      return process.env["INTERNAL_API_URL"] ?? "http://api:3001";
    }
    return configuredUrl;
  }

  if (configuredUrl.startsWith("/")) {
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
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

function getToken(): string | null {
  return getUsableStoredAuthToken();
}

function normalizeRequestUrl(url: string, baseUrl: string): string {
  if (!baseUrl.startsWith("/")) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith(`${baseUrl}/`)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${baseUrl}${url}`;
  }

  return `${baseUrl}/${url}`;
}

api.interceptors.request.use((config) => {
  const dynamicBaseUrl = getApiBaseUrl();
  const isRelativeProxyBase = dynamicBaseUrl.startsWith("/");
  if (isRelativeProxyBase) {
    delete config.baseURL;
  } else {
    config.baseURL = dynamicBaseUrl;
  }

  if (typeof config.url === "string" && isRelativeProxyBase) {
    config.url = normalizeRequestUrl(config.url, dynamicBaseUrl);
  }

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
      clearStoredAuthToken();
      if (window.location.pathname.startsWith("/dashboard")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

