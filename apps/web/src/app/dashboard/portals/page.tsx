"use client";

import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { usePortals, useConnectPortal, useDisconnectPortal, useCreateCustomPortal, useDeleteCustomPortal } from "@/hooks/usePortals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl } from "@/lib/api";

type PortalRecord = {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  connected: boolean;
  ready?: boolean;
  status?: "connected" | "needs_attention" | "not_connected" | "custom";
  lastSynced?: string | null;
  lastError?: string | null;
  helpText?: string | null;
  isCustom?: boolean;
};

function getPortalBadge(portal: PortalRecord) {
  if (portal.isCustom) {
    return { label: "Custom", className: "bg-sky-600/20 text-sky-200" };
  }

  if (portal.status === "connected") {
    return { label: "Ready", className: "bg-emerald-600/20 text-emerald-200" };
  }

  if (portal.status === "needs_attention") {
    return { label: "Needs attention", className: "bg-amber-600/20 text-amber-100" };
  }

  return { label: "Not connected", className: "bg-white/10 text-white/70" };
}

export default function PortalsPage() {
  const portalsQ = usePortals();
  const connect = useConnectPortal();
  const disconnect = useDisconnectPortal();
  const createCustom = useCreateCustomPortal();
  const deleteCustom = useDeleteCustomPortal();
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [activePortalName, setActivePortalName] = useState<string | null>(null);

  const portals = useMemo(() => {
    const items = (portalsQ.data?.portals ?? []) as PortalRecord[];
    return [...items].sort((a, b) => {
      const rank = (portal: PortalRecord) => {
        if (portal.status === "needs_attention") return 0;
        if (portal.status === "connected") return 1;
        if (portal.isCustom) return 2;
        return 3;
      };

      return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName);
    });
  }, [portalsQ.data?.portals]);

  const handleAddCustom = async () => {
    if (!customName || !customUrl) {
      return;
    }

    try {
      await createCustom.mutateAsync({ name: customName, url: customUrl });
      toast({ title: "Custom portal added", description: `${customName} has been added to your portals.` });
      setCustomName("");
      setCustomUrl("");
      setIsAddingCustom(false);
    } catch (err: any) {
      toast({
        title: "Failed to add portal",
        description: err?.response?.data?.error ?? "Could not add custom portal",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">Portals</div>
        <Button onClick={() => setIsAddingCustom(true)} variant="outline">
          + Add Custom Portal
        </Button>
      </div>

      {isAddingCustom ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-3 p-4">
            <div className="font-semibold">Add Custom Job Portal</div>
            <Input
              className="border-white/10 bg-white/5"
              placeholder="Portal Name (for example, Indeed)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <Input
              className="border-white/10 bg-white/5"
              placeholder="Portal URL (for example, https://indeed.com)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleAddCustom} disabled={createCustom.isPending || !customName || !customUrl}>
                {createCustom.isPending ? "Adding..." : "Add Portal"}
              </Button>
              <Button variant="secondary" onClick={() => setIsAddingCustom(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {portalsQ.isLoading ? <div className="text-sm text-white/70">Loading portals...</div> : null}
      {portalsQ.isError ? <div className="text-sm text-rose-300">Failed to load portals. Try refreshing.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {portals.map((portal) => {
          const badge = getPortalBadge(portal);
          const isDialogOpen = activePortalName === portal.name;

          return (
          <Card key={portal.name} className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{portal.displayName}</div>
                <Badge className={badge.className}>{badge.label}</Badge>
              </div>

              <div className="text-xs text-white/60">{portal.description}</div>
              <div className="text-xs text-white/60">
                Last synced: {portal.lastSynced ? new Date(portal.lastSynced).toLocaleString() : "Not available"}
              </div>
              {portal.lastError ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <div className="font-medium">Needs attention</div>
                  <div className="mt-1">{portal.lastError}</div>
                  {portal.helpText ? <div className="mt-2 text-amber-100/80">{portal.helpText}</div> : null}
                </div>
              ) : null}

              <div className="flex gap-2">
                {portal.name === "linkedin" ? (
                  <Button
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                    onClick={() => {
                      window.location.href = `${getApiBaseUrl().replace(/\/$/, "")}/api/auth/linkedin`;
                    }}
                  >
                    {portal.status === "connected" ? "Reconnect" : "Connect"}
                  </Button>
                ) : portal.isCustom ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={!portal.id}
                    onClick={() =>
                      portal.id &&
                      deleteCustom.mutate(portal.id, {
                        onSuccess: () => toast({ title: "Deleted", description: `${portal.displayName} removed.` }),
                        onError: (err: any) =>
                          toast({
                            title: "Delete failed",
                            description: err?.response?.data?.error ?? "Could not delete portal",
                            variant: "destructive"
                          })
                      })
                    }
                  >
                    Delete
                  </Button>
                ) : (
                  <Dialog open={isDialogOpen} onOpenChange={(open) => setActivePortalName(open ? portal.name : null)}>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant={portal.status === "needs_attention" ? "default" : "secondary"}>
                        {portal.status === "connected" ? "Reconnect" : portal.status === "needs_attention" ? "Fix connection" : "Connect"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-white/10 bg-[#0b1224] text-white">
                      <DialogHeader>
                        <DialogTitle>Connect {portal.displayName}</DialogTitle>
                        <DialogDescription className="text-white/60">
                          Credentials are encrypted at rest and only used for automation you have enabled.
                        </DialogDescription>
                      </DialogHeader>
                      <PortalConnectForm
                        portal={portal}
                        onSave={async (credentials) => {
                          try {
                            const result = await connect.mutateAsync({ portalName: portal.name, credentials });
                            toast({
                              title: result?.success ? "Connected" : "Saved",
                              description: result?.message ?? "Done"
                            });
                            if (result?.success) {
                              setActivePortalName(null);
                            }
                          } catch (err: any) {
                            toast({
                              title: "Connect failed",
                              description: err?.response?.data?.error ?? err?.message ?? "Could not connect portal",
                              variant: "destructive"
                            });
                          }
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                )}

                {portal.connected && !portal.isCustom ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() =>
                      disconnect.mutate(portal.name, {
                        onSuccess: () => toast({ title: "Disconnected", description: `${portal.displayName} disconnected.` }),
                        onError: (err: any) =>
                          toast({
                            title: "Disconnect failed",
                            description: err?.response?.data?.error ?? err?.message ?? "Could not disconnect",
                            variant: "destructive"
                          })
                      })
                    }
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )})}
      </div>
    </div>
  );
}

function PortalConnectForm({
  portal,
  onSave
}: {
  portal: PortalRecord;
  onSave: (creds: Record<string, string>) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {portal.lastError ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="font-medium">Current issue</div>
          <div className="mt-1">{portal.lastError}</div>
        </div>
      ) : null}
      <Input className="border-white/10 bg-white/5" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        className="border-white/10 bg-white/5"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {result ? <div className="text-xs text-white/70">{result}</div> : null}
      <Button
        className="w-full"
        disabled={loading || !email || !password}
        onClick={async () => {
          setLoading(true);
          setResult(null);
          try {
            await onSave({ email, password });
            setResult("Credentials saved and verification completed.");
          } catch (err: any) {
            setResult(err?.response?.data?.error ?? err?.message ?? "Failed to connect.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Saving..." : "Save and Test"}
      </Button>
    </div>
  );
}
