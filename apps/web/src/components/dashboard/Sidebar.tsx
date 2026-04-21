"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Globe, User, Settings, PanelLeftClose, PanelLeftOpen, Zap, Wrench, Sparkles, Landmark, BookOpen, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/store/uiStore";
import { useAgentStatus, usePauseAgent, useStartAgent } from "@/hooks/useAgent";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { clearStoredAuthToken } from "@/lib/auth-client";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/applications", label: "Applications", icon: FileText },
  { href: "/dashboard/portals", label: "Portals", icon: Globe },
  { href: "/dashboard/custom-portals", label: "Custom Portals", icon: Wrench },
  { href: "/dashboard/youth", label: "Youth Opportunities", icon: Sparkles },
  { href: "/dashboard/gov-jobs", label: "Gov Jobs Pakistan", icon: Landmark },
  { href: "/dashboard/answer-library", label: "Answer Library", icon: BookOpen },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const setCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const statusQ = useAgentStatus();
  const start = useStartAgent();
  const pause = usePauseAgent();
  const enabled = Boolean(statusQ.data?.enabled);
  const unreadCount = Number(useUnreadNotificationCount().data?.count ?? 0);

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 h-screen border-r border-white/10 bg-[#050914]/85 px-2 py-3 backdrop-blur-xl",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="rounded-2xl border border-slate-400/20 bg-slate-900/40 p-3 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div className={cn("font-semibold tracking-wide text-slate-100", collapsed && "sr-only")}>AutoApply</div>
          <Button size="icon" variant="ghost" className="text-slate-300 hover:bg-white/10" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                active
                  ? "border-indigo-300/40 bg-indigo-500/20 text-white shadow-lg shadow-indigo-900/20"
                  : "border-transparent text-slate-300 hover:border-slate-400/20 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className={cn(collapsed && "hidden")}>{item.label}</span>
              {!collapsed && item.href === "/dashboard/notifications" && unreadCount > 0 ? (
                <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 px-2">
        <Separator className="bg-white/10" />
      </div>

      <div className="mt-4 rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-[#0f172a]/80 to-[#111827]/80 p-3 shadow-xl shadow-black/35">
        <div className={cn("mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400", collapsed && "justify-center")}>
          <Zap className="h-3.5 w-3.5 text-indigo-300" />
          <span className={cn(collapsed && "hidden")}>Agent</span>
        </div>
        <div className={cn("flex items-center justify-between gap-2", collapsed && "flex-col")}>
          <div className={cn("flex items-center gap-2", collapsed && "hidden")}>
            <div className={cn("h-2.5 w-2.5 rounded-full", enabled ? "bg-emerald-400" : "bg-rose-400")} />
            <div className="text-sm font-medium text-slate-100">{enabled ? "Running" : "Paused"}</div>
          </div>
          <Button
            size="sm"
            className={cn("w-full", !enabled && "bg-indigo-500 hover:bg-indigo-400")}
            variant={enabled ? "secondary" : "default"}
            onClick={() => (enabled ? pause.mutate() : start.mutate())}
          >
            {enabled ? "Pause" : "Start"}
          </Button>
        </div>
        <div className={cn("mt-3 text-xs text-slate-400", collapsed && "hidden")}>
          Last run: {statusQ.data?.lastRun ? new Date(statusQ.data.lastRun).toLocaleString() : "Not available"}
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white"
          onClick={() => {
            clearStoredAuthToken();
            router.replace("/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className={cn(collapsed && "hidden")}>Sign out</span>
        </Button>
      </div>
    </aside>
  );
}
