"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { usePortals, useConnectPortal, useDisconnectPortal, useCreateCustomPortal, useDeleteCustomPortal } from "@/hooks/usePortals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, getApiBaseUrl } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";

type PortalRecord = {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  connected: boolean;
  ready?: boolean;
  requiresAuth?: boolean;
  connectionMode?: "oauth" | "credentials" | "none";
  portalKind?: "source" | "ats";
  status?: "connected" | "needs_attention" | "not_connected" | "custom" | "available" | "built_in";
  lastSynced?: string | null;
  lastError?: string | null;
  helpText?: string | null;
  isCustom?: boolean;
};

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null) {
    const response = "response" in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
    const message = "message" in err ? (err as { message?: string }).message : undefined;
    return response?.data?.error ?? message ?? fallback;
  }

  return fallback;
}

function getPortalCredentialHint(portal: PortalRecord) {
  if (portal.name === "jobright") {
    return "Use the credentials for your JobRight account. If you normally sign in through Google or Apple, direct password verification may require a dedicated SSO flow.";
  }

  if (portal.name === "wellfound") {
    return "Use the credentials for your Wellfound account. Social sign-in only accounts may need a separate connection flow.";
  }

  if (portal.name === "mercor") {
    return "Use the credentials for your Mercor account. If Mercor requires Google OAuth or extra verification, the portal may still need manual attention.";
  }

  return "Use the credentials for this portal account. They are encrypted at rest and only used for automation you have enabled.";
}

function getPortalBadge(portal: PortalRecord) {
  if (portal.isCustom) {
    return { label: "Custom", className: "bg-sky-600/20 text-sky-200" };
  }

  if (portal.status === "available") {
    return { label: "Available", className: "bg-sky-600/20 text-sky-100" };
  }

  if (portal.status === "built_in") {
    return { label: "Built in", className: "bg-violet-600/20 text-violet-100" };
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
  return (
    <Suspense fallback={<div className="text-sm text-white/70">Loading portals...</div>}>
      <PortalsPageContent />
    </Suspense>
  );
}

function PortalsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalsQ = usePortals();
  const connect = useConnectPortal();
  const disconnect = useDisconnectPortal();
  const createCustom = useCreateCustomPortal();
  const deleteCustom = useDeleteCustomPortal();
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [activePortalName, setActivePortalName] = useState<string | null>(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("linkedin") !== "not-configured") {
      return;
    }

    const missing = searchParams.get("missing");
    const description = missing
      ? `LinkedIn OAuth is not configured yet. Missing: ${missing.split(",").join(", ")}.`
      : "LinkedIn OAuth is not configured yet.";
    setLinkedinMessage(description);
    toast({
      title: "LinkedIn connect is not configured",
      description,
      variant: "destructive"
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("linkedin");
    params.delete("missing");
    const next = params.toString();
    router.replace(next ? `/dashboard/portals?${next}` : "/dashboard/portals");
  }, [router, searchParams]);

  const portals = useMemo(() => {
    const items = (portalsQ.data?.portals ?? []) as PortalRecord[];
    return [...items].sort((a, b) => {
      const rank = (portal: PortalRecord) => {
        if (portal.status === "needs_attention") return 0;
        if (portal.status === "connected") return 1;
        if (portal.status === "available") return 2;
        if (portal.status === "built_in") return 3;
        if (portal.isCustom) return 4;
        return 5;
      };

      return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName);
    });
  }, [portalsQ.data?.portals]);

  const handleLinkedInConnect = async () => {
    setLinkedinLoading(true);
    setLinkedinMessage(null);

    try {
      const status = await api.get("/api/auth/linkedin/status");
      if (!status.data?.configured) {
        const missing = Array.isArray(status.data?.missing) ? status.data.missing.join(", ") : "LinkedIn OAuth settings";
        const message = `LinkedIn OAuth still needs setup. Missing: ${missing}.`;
        setLinkedinMessage(message);
        toast({
          title: "LinkedIn connect is not ready",
          description: message,
          variant: "destructive"
        });
        return;
      }

      window.location.href = `${getApiBaseUrl().replace(/\/$/, "")}/api/auth/linkedin`;
    } catch (err: any) {
      const message = getErrorMessage(err, "Could not start LinkedIn authentication.");
      setLinkedinMessage(message);
      toast({
        title: "LinkedIn connect failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLinkedinLoading(false);
    }
  };

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
        description: getErrorMessage(err, "Could not add custom portal"),
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

      <Card className="card-cinematic">
        <CardContent className="grid gap-4 p-4 text-sm text-white/70 md:grid-cols-3">
          <div>
            <div className="font-semibold text-white">Authenticated portals</div>
            <div className="mt-1">LinkedIn, JobRight.ai, Mercor, and Wellfound need your portal login or OAuth before the agent can use them.</div>
          </div>
          <div>
            <div className="font-semibold text-white">Public source portals</div>
            <div className="mt-1">RemoteOK, Remotive, Himalayas, We Work Remotely, and Remote.co are available immediately and do not require credentials.</div>
          </div>
          <div>
            <div className="font-semibold text-white">Built-in ATS handlers</div>
            <div className="mt-1">Greenhouse, Lever, and Workday are used automatically when a job redirects to those application systems.</div>
          </div>
        </CardContent>
      </Card>

      {isAddingCustom ? (
        <Card className="card-cinematic">
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
          <Card key={portal.name} className="card-cinematic">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{portal.displayName}</div>
                <Badge className={badge.className}>{badge.label}</Badge>
              </div>

              <div className="text-xs text-white/60">{portal.description}</div>
              <div className="text-xs text-white/60">
                {portal.status === "available"
                  ? "This source is active by default and will be used by the agent when it runs."
                  : portal.status === "built_in"
                    ? "This handler activates automatically when an application redirects to this ATS."
                    : `Last synced: ${portal.lastSynced ? new Date(portal.lastSynced).toLocaleString() : "Not available"}`}
              </div>
              {portal.lastError ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <div className="font-medium">Needs attention</div>
                  <div className="mt-1">{portal.lastError}</div>
                  {portal.helpText ? <div className="mt-2 text-amber-100/80">{portal.helpText}</div> : null}
                </div>
              ) : null}

              <div className="flex gap-2">
                {portal.status === "available" ? (
                  <div className="w-full rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-center text-sm text-sky-100">
                    Available by default
                  </div>
                ) : portal.status === "built_in" ? (
                  <div className="w-full rounded-md border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center text-sm text-violet-100">
                    Handled automatically during apply
                  </div>
                ) : portal.name === "linkedin" ? (
                  <div className="w-full space-y-2">
                    <Button className="w-full bg-[#6366f1] hover:bg-[#5558e6]" disabled={linkedinLoading} onClick={handleLinkedInConnect}>
                      {linkedinLoading ? "Checking..." : portal.status === "connected" ? "Reconnect" : "Connect"}
                    </Button>
                    {linkedinMessage ? <div className="text-xs text-amber-100">{linkedinMessage}</div> : null}
                  </div>
                ) : portal.isCustom ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={!portal.id}
                    onClick={() =>
                      portal.id &&
                      deleteCustom.mutate(portal.id, {
                        onSuccess: () => toast({ title: "Deleted", description: `${portal.displayName} removed.` }),
                        onError: (err: unknown) =>
                          toast({
                            title: "Delete failed",
                            description: getErrorMessage(err, "Could not delete portal"),
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
                          {getPortalCredentialHint(portal)}
                        </DialogDescription>
                      </DialogHeader>
                      <PortalConnectForm
                        portal={portal}
                        onSave={async (credentials, manualCookies) => await connect.mutateAsync({ portalName: portal.name, credentials, ...(manualCookies ? { manualCookies } : {}) })}
                        onSuccess={(result) => {
                          toast({
                            title: result?.success ? "Connected" : "Verification needs attention",
                            description: result?.message ?? "Done"
                          });
                          if (result?.success) {
                            setActivePortalName(null);
                          }
                        }}
                        onError={(err) => {
                          toast({
                            title: "Connect failed",
                            description: getErrorMessage(err, "Could not connect portal"),
                            variant: "destructive"
                          });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                )}

                {portal.connected && portal.requiresAuth && !portal.isCustom ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() =>
                      disconnect.mutate(portal.name, {
                        onSuccess: () => toast({ title: "Disconnected", description: `${portal.displayName} disconnected.` }),
                        onError: (err: unknown) =>
                          toast({
                            title: "Disconnect failed",
                            description: getErrorMessage(err, "Could not disconnect"),
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
  onSave,
  onSuccess,
  onError
}: {
  portal: PortalRecord;
  onSave: (creds: Record<string, string>, manualCookies?: string) => Promise<{ success?: boolean; message?: string }>;
  onSuccess: (result: { success?: boolean; message?: string }) => void;
  onError: (err: unknown) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [manualCookies, setManualCookies] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {portal.lastError ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="font-medium">Current issue</div>
          <div className="mt-1">{portal.lastError}</div>
          <div className="mt-2 text-xs text-amber-100/80">
            If login is completely blocked, you can use a browser extension (like EditThisCookie) to export your session cookies as JSON and paste them below.
          </div>
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
      {portal.lastError ? (
        <Input
          className="border-white/10 bg-white/5 border-dashed"
          placeholder="Optional: Paste session cookies array [{...}]"
          type="text"
          value={manualCookies}
          onChange={(e) => setManualCookies(e.target.value)}
        />
      ) : null}
      {result ? <div className="text-xs text-white/70">{result}</div> : null}
      <Button
        className="w-full"
        disabled={loading || (!manualCookies && (!email || !password))}
        onClick={async () => {
          setLoading(true);
          setResult(null);
          try {
            const response = await onSave(
              { email, password },
              manualCookies ? manualCookies : undefined
            );
            onSuccess(response);
            setResult(
              response?.success
                ? response?.message ?? "Credentials saved and verification completed."
                : response?.message ?? "Credentials were saved, but this portal still needs attention."
            );
          } catch (err: any) {
            onError(err);
            setResult(getErrorMessage(err, "Failed to connect."));
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
