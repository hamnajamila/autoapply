"use client";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-6">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-white/70 mt-1">{description}</div>
      </CardContent>
    </Card>
  );
}

