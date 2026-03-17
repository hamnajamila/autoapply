"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MatchScoreChart({ data }: { data: Array<{ date: string; count: number }> }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-base">Applications per day (14d)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,.6)", fontSize: 10 }} />
            <YAxis tick={{ fill: "rgba(255,255,255,.6)", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#0b1224", border: "1px solid rgba(255,255,255,.1)", color: "white" }} />
            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

