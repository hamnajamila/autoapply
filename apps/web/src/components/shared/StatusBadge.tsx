"use client";

import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "bg-emerald-600/20 text-emerald-200 border-emerald-500/30" },
  FAILED: { label: "Failed", className: "bg-rose-600/20 text-rose-200 border-rose-500/30" },
  PENDING: { label: "Pending", className: "bg-sky-600/20 text-sky-200 border-sky-500/30" },
  SKIPPED_THRESHOLD: { label: "Skipped (threshold)", className: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
  SKIPPED_DUPLICATE: { label: "Skipped (duplicate)", className: "bg-slate-600/20 text-slate-200 border-slate-500/30" },
  SKIPPED_CAPTCHA: { label: "Skipped (captcha)", className: "bg-violet-600/20 text-violet-200 border-violet-500/30" },
  SKIPPED_MANUAL: { label: "Manual required", className: "bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-500/30" },
  UNCERTAIN: { label: "Uncertain", className: "bg-zinc-600/20 text-zinc-200 border-zinc-500/30" }
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, className: "bg-zinc-600/20 text-zinc-200 border-zinc-500/30" };
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}

