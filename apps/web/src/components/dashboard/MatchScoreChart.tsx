"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MatchScoreChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const hasData = data.some((entry) => entry.count > 0);

  return (
    <Card className="card-cinematic">
      <CardHeader>
        <CardTitle className="text-base">Applications per day (14d)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="date" tick={{ fill: "rgba(226,232,240,0.65)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(226,232,240,0.65)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#0b1224",
                  border: "1px solid rgba(148,163,184,0.25)",
                  color: "white",
                  borderRadius: 10
                }}
              />
              <Bar dataKey="count" fill="#7c83ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 text-sm text-white/60">
            Application activity will appear here after the first successful scoring run.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

