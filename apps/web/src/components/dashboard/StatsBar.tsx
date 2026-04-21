"use client";

import { Card, CardContent } from "@/components/ui/card";

export function StatsBar({ stats }: { stats: any }) {
  const items = [
    { label: "Total Applications Sent", value: stats?.totalApplications ?? 0 },
    { label: "Applied This Week", value: stats?.thisWeek ?? 0 },
    { label: "Average Match Score", value: stats?.avgScore ?? 0 },
    { label: "Portals Ready", value: stats?.portalsConnected ?? 0 }
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <Card key={i.label} className="card-cinematic">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-300/70">{i.label}</div>
            <div className="mt-1 text-2xl font-bold text-white">{i.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

