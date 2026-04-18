"use client";

import { useMemo, useState } from "react";
import { AgentStatusBanner } from "@/components/dashboard/AgentStatusBanner";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable";
import { ApplicationDrawer } from "@/components/dashboard/ApplicationDrawer";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useApplication } from "@/hooks/useApplications";
import { MatchScoreChart } from "@/components/dashboard/MatchScoreChart";

export default function DashboardOverview() {
  const statsQ = useDashboardStats();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const appQ = useApplication(selectedId);

  const recent = statsQ.data?.recentApplications ?? [];
  const perDay = statsQ.data?.applicationsByDay ?? [];

  const chartData = useMemo(
    () => (statsQ.data?.applicationsByDay ?? []).map((d: any) => ({ date: String(d.date).slice(5), count: Number(d.count ?? 0) })),
    [statsQ.data?.applicationsByDay]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="text-sm text-slate-300/80">Live mission snapshot for scraping, matching, and application automation.</p>
      </div>
      <AgentStatusBanner />
      <StatsBar stats={statsQ.data} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-lg font-semibold">Recent applications</div>
          <ApplicationsTable rows={recent} onView={(id) => setSelectedId(id)} />
        </div>
        <MatchScoreChart data={chartData} />
      </div>

      <ApplicationDrawer open={Boolean(selectedId)} onOpenChange={(v) => (!v ? setSelectedId(null) : undefined)} application={appQ.data ?? null} />
    </div>
  );
}

