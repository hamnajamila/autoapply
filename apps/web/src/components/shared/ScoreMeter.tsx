"use client";

import { cn } from "@/lib/utils";

export function ScoreMeter({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const color =
    s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${s}%` }} />
      </div>
      <div className={cn("text-xs font-semibold", s >= 80 ? "text-emerald-200" : s >= 60 ? "text-amber-200" : "text-rose-200")}>
        {s}
      </div>
    </div>
  );
}

