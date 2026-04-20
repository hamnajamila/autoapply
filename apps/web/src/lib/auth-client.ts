"use client";

const TOKEN_KEY = "autoapply_token";

type JwtPayload = {
  exp?: number;
};

function parseJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const encodedPayload = parts[1];
    if (!encodedPayload) {
      return null;
    }

    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}

export function isTokenUsable(token: string | null | undefined): boolean {
  if (!token || typeof window === "undefined") {
    return false;
  }

  const payload = parseJwtPayload(token);
  if (!payload) {
    return false;
  }

  if (typeof payload.exp !== "number") {
    return true;
  }

  return payload.exp * 1000 > Date.now();
}

export function getUsableStoredAuthToken() {
  const token = getStoredAuthToken();
  if (!isTokenUsable(token)) {
    clearStoredAuthToken();
    return null;
  }

  return token;
}
