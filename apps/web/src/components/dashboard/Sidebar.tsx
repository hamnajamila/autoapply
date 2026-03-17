"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/store/uiStore";
import { useAgentStatus, usePauseAgent, useStartAgent } from "@/hooks/useAgent";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/applications", label: "Applications" },
  { href: "/dashboard/portals", label: "Portals" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" }
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  const statusQ = useAgentStatus();
  const start = useStartAgent();
  const pause = usePauseAgent();
  const enabled = Boolean(statusQ.data?.enabled);

  return (
    <aside className={cn("h-screen sticky top-0 border-r border-white/10 bg-black/20", collapsed ? "w-16" : "w-64")}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className={cn("font-bold tracking-tight", collapsed && "hidden")}>AutoApply</div>
          <Button size="sm" variant="secondary" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "→" : "←"}
          </Button>
        </div>
      </div>
      <Separator className="bg-white/10" />
      <nav className="p-2 space-y-1">
        {nav.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              {collapsed ? n.label.slice(0, 1) : n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4 space-y-3">
        <Separator className="bg-white/10" />
        <div className={cn("text-xs text-white/70", collapsed && "hidden")}>Agent</div>
        <div className="flex items-center justify-between gap-2">
          <div className={cn("flex items-center gap-2", collapsed && "hidden")}>
            <div className={cn("h-2 w-2 rounded-full", enabled ? "bg-emerald-400" : "bg-rose-400")} />
            <div className="text-sm">{enabled ? "Running" : "Paused"}</div>
          </div>
          <Button
            size="sm"
            className="w-full"
            variant={enabled ? "secondary" : "default"}
            onClick={() => (enabled ? pause.mutate() : start.mutate())}
          >
            {enabled ? "Pause" : "Start"}
          </Button>
        </div>
        <div className={cn("text-xs text-white/60", collapsed && "hidden")}>
          Last run: {statusQ.data?.lastRun ? new Date(statusQ.data.lastRun).toLocaleString() : "—"}
        </div>
      </div>
    </aside>
  );
}

