"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePortals, useConnectPortal, useDisconnectPortal } from "@/hooks/usePortals";
import { useState } from "react";

export default function PortalsPage() {
  const portalsQ = usePortals();
  const connect = useConnectPortal();
  const disconnect = useDisconnectPortal();

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Portals</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(portalsQ.data?.portals ?? []).map((p: any) => (
          <Card key={p.name} className="bg-white/5 border-white/10">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{p.displayName}</div>
                <Badge className={p.connected ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70"}>
                  {p.connected ? "Connected ✓" : "Not connected"}
                </Badge>
              </div>
              <div className="text-xs text-white/60">{p.description}</div>
              <div className="text-xs text-white/60">
                Last synced: {p.lastSynced ? new Date(p.lastSynced).toLocaleString() : "—"}
              </div>
              {p.lastError ? <div className="text-xs text-rose-300">Last error: {p.lastError}</div> : null}
              <div className="flex gap-2">
                {p.name === "linkedin" ? (
                  <Button
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                    onClick={() =>
                      (window.location.href = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/auth/linkedin`)
                    }
                  >
                    {p.connected ? "Reconnect" : "Connect"}
                  </Button>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant="secondary">
                        {p.connected ? "Reconnect" : "Connect"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0b1224] border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Connect {p.displayName}</DialogTitle>
                      </DialogHeader>
                      <PortalConnectForm
                        onSave={async (creds) => {
                          await connect.mutateAsync({ portalName: p.name, credentials: creds });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                )}

                {p.connected ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => disconnect.mutate(p.name)}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PortalConnectForm({ onSave }: { onSave: (creds: Record<string, string>) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="text-sm text-white/70">Credentials are encrypted at rest.</div>
      <Input className="bg-white/5 border-white/10" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input className="bg-white/5 border-white/10" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {result ? <div className="text-xs text-white/70">{result}</div> : null}
      <Button
        className="w-full"
        disabled={loading || !email || !password}
        onClick={async () => {
          setLoading(true);
          setResult(null);
          try {
            await onSave({ email, password });
            setResult("Saved & tested.");
          } catch (e: any) {
            setResult(e?.message ?? "Failed to connect.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Saving..." : "Save & Test"}
      </Button>
    </div>
  );
}

