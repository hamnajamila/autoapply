"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PortalCard({
  portal,
  onConnect,
  onDisconnect
}: {
  portal: any;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{portal.displayName}</div>
          <Badge className={portal.connected ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70"}>
            {portal.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <div className="text-xs text-white/60">{portal.description}</div>
        <div className="flex gap-2">
          <Button className="w-full" variant={portal.connected ? "secondary" : "default"} onClick={onConnect}>
            {portal.connected ? "Reconnect" : "Connect"}
          </Button>
          {portal.connected ? (
            <Button className="w-full" variant="destructive" onClick={onDisconnect}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
