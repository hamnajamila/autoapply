"use client";

import { useMemo, useState } from "react";
import { useApplications, useApplication } from "@/hooks/useApplications";
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable";
import { ApplicationDrawer } from "@/components/dashboard/ApplicationDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/api";

export default function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number>(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useApplications({
    page,
    limit: 25,
    ...(status !== "all" ? { status } : {}),
    minScore,
    maxScore
  });
  const appQ = useApplication(selectedId);

  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  const rows = q.data?.data ?? [];

  const scoreLabel = useMemo(() => `${minScore}-${maxScore}`, [minScore, maxScore]);

  const handleExport = async () => {
    const response = await api.get("/api/applications", {
      params: {
        format: "csv",
        page: 1,
        limit: 200,
        ...(status !== "all" ? { status } : {}),
        minScore,
        maxScore
      },
      responseType: "blob"
    });

    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "applications.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Applications</div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-white/60">Status</div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b1224] border-white/10 text-white">
                <SelectItem value="all">All</SelectItem>
                {["PENDING", "SUBMITTED", "FAILED", "SKIPPED_THRESHOLD", "SKIPPED_DUPLICATE", "SKIPPED_CAPTCHA", "SKIPPED_MANUAL", "UNCERTAIN"].map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/60">Score range</div>
              <div className="text-xs text-white/70">{scoreLabel}</div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span>Lower fit</span>
              <span>Stronger fit</span>
            </div>
            <Slider
              value={[minScore, maxScore]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                setMinScore(v[0] ?? 0);
                setMaxScore(v[1] ?? 100);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {rows.length ? (
        <ApplicationsTable rows={rows} onView={(id) => setSelectedId(id)} />
      ) : (
        <EmptyState
          title="No applications yet"
          description="Once the agent scores jobs or you submit applications, they will appear here with filters, exports, and drill-down details."
        />
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">
          Page {page} of {pages} (total {total})
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
          <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>

      <ApplicationDrawer
        open={Boolean(selectedId)}
        onOpenChange={(v) => (!v ? setSelectedId(null) : undefined)}
        application={appQ.data ?? null}
      />
    </div>
  );
}

