"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ConnectPortalsStep({
  onBack,
  onContinue,
  children
}: {
  onBack: () => void;
  onContinue: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle>Step 2 - Connect job portals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={onBack}>
            {"<-"} Back
          </Button>
          <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
