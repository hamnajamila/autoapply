import axios from "axios";

export const api = axios.create({
  baseURL: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001",
  withCredentials: true
});

export function setAuthToken(token: string | null) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

