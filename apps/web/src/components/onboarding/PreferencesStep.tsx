"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PreferencesStep({
  onBack,
  onFinish,
  finishLabel,
  children,
  disabled
}: {
  onBack: () => void;
  onFinish: () => void;
  finishLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle>Step 3 — Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <Button className="bg-[#6366f1] hover:bg-[#5558e6]" disabled={disabled} onClick={onFinish}>
            {finishLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

