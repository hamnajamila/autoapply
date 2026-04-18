"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get("token");
    const token = urlToken || localStorage.getItem("autoapply_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    localStorage.setItem("autoapply_token", token);
    if (urlToken) {
      const nextUrl = window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [router]);

  return (
    <div className="dashboard-shell flex">
      <Sidebar />
      <main className="dashboard-main flex-1 px-4 py-6 md:px-6 lg:px-8">
        {children}
        <Toaster />
      </main>
    </div>
  );
}

