"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { usePortals, useConnectPortal, useDisconnectPortal, useCreateCustomPortal, useDeleteCustomPortal } from "@/hooks/usePortals";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function PortalsPage() {
  const portalsQ = usePortals();
  const connect = useConnectPortal();
  const disconnect = useDisconnectPortal();
  const createCustom = useCreateCustomPortal();
  const deleteCustom = useDeleteCustomPortal();
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

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
        {(portalsQ.data?.portals ?? []).map((portal: any) => (
          <Card key={portal.name} className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{portal.displayName}</div>
                <Badge className={portal.connected ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70"}>
                  {portal.isCustom ? "Custom" : portal.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>

              <div className="text-xs text-white/60">{portal.description}</div>
              <div className="text-xs text-white/60">
                Last synced: {portal.lastSynced ? new Date(portal.lastSynced).toLocaleString() : "Not available"}
              </div>
              {portal.lastError ? <div className="text-xs text-rose-300">Last error: {portal.lastError}</div> : null}

              <div className="flex gap-2">
                {portal.name === "linkedin" ? (
                  <Button
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                    onClick={() => {
                      window.location.href = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/auth/linkedin`;
                    }}
                  >
                    {portal.connected ? "Reconnect" : "Connect"}
                  </Button>
                ) : portal.isCustom ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() =>
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant="secondary">
                        {portal.connected ? "Reconnect" : "Connect"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-white/10 bg-[#0b1224] text-white">
                      <DialogHeader>
                        <DialogTitle>Connect {portal.displayName}</DialogTitle>
                      </DialogHeader>
                      <PortalConnectForm
                        onSave={async (credentials) => {
                          try {
                            const result = await connect.mutateAsync({ portalName: portal.name, credentials });
                            toast({
                              title: result?.success ? "Connected" : "Saved",
                              description: result?.message ?? "Done"
                            });
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
            setResult("Saved and tested.");
          } catch (err: any) {
            setResult(err?.message ?? "Failed to connect.");
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
