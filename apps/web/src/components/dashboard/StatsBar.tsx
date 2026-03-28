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
        <Card key={i.label} className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-xs text-white/60">{i.label}</div>
            <div className="text-2xl font-bold mt-1">{i.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

