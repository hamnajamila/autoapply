import axios from "axios";

export const api = axios.create({
  baseURL: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001",
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

