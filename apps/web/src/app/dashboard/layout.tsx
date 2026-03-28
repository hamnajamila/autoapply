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
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6 bg-[#0f172a]">
        {children}
        <Toaster />
      </main>
    </div>
  );
}

