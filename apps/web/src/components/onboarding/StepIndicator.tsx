"use client";

import { Progress } from "@/components/ui/progress";

export function StepIndicator({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="space-y-2">
      <div className="text-sm text-white/70">
        Step {step} of {total}
      </div>
      <Progress value={pct} className="bg-white/10" />
    </div>
  );
}

