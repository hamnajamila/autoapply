"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { clearStoredAuthToken, getUsableStoredAuthToken, isTokenUsable, setStoredAuthToken } from "@/lib/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get("token");
    const token = urlToken && isTokenUsable(urlToken) ? urlToken : getUsableStoredAuthToken();
    if (!token) {
      clearStoredAuthToken();
      router.replace("/login");
      return;
    }
    setStoredAuthToken(token);
    if (urlToken) {
      const nextUrl = window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [router]);

  return (
    <div className="dashboard-shell flex">
      <Sidebar />
      <main className="dashboard-main flex-1 px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6 flex justify-end">
          <NotificationBell />
        </div>
        {children}
        <Toaster />
      </main>
    </div>
  );
}

