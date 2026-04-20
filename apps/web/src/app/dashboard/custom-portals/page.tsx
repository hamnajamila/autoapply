"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCreateCustomPortalRecord,
  useCustomPortals,
  useDeleteCustomPortalRecord,
  useTestCustomPortal,
  useToggleCustomPortalRecord
} from "@/hooks/useCustomPortals";
import { toast } from "@/hooks/use-toast";

export default function CustomPortalsPage() {
  const customPortalsQ = useCustomPortals();
  const createPortal = useCreateCustomPortalRecord();
  const deletePortal = useDeleteCustomPortalRecord();
  const togglePortal = useToggleCustomPortalRecord();
  const testPortal = useTestCustomPortal();

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [listingSelector, setListingSelector] = useState("a[href]");
  const [titleSelector, setTitleSelector] = useState("");
  const [companySelector, setCompanySelector] = useState("");
  const [locationSelector, setLocationSelector] = useState("");

  const sampleRows = useMemo(() => testPortal.data?.sample ?? [], [testPortal.data?.sample]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Custom Portals</h1>
          <p className="text-sm text-white/65">Define additional job portals and preview the selectors before saving.</p>
        </div>
      </div>

      <Card className="card-cinematic">
        <CardHeader>
          <CardTitle className="text-lg">Add portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input className="border-white/10 bg-white/5" placeholder="Portal name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input className="border-white/10 bg-white/5" placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <Input className="border-white/10 bg-white/5 md:col-span-2" placeholder="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input className="border-white/10 bg-white/5" placeholder="Listing selector" value={listingSelector} onChange={(event) => setListingSelector(event.target.value)} />
            <Input className="border-white/10 bg-white/5" placeholder="Title selector" value={titleSelector} onChange={(event) => setTitleSelector(event.target.value)} />
            <Input className="border-white/10 bg-white/5" placeholder="Company selector" value={companySelector} onChange={(event) => setCompanySelector(event.target.value)} />
            <Input className="border-white/10 bg-white/5" placeholder="Location selector" value={locationSelector} onChange={(event) => setLocationSelector(event.target.value)} />
          </div>
          <Textarea
            className="min-h-[96px] border-white/10 bg-white/5"
            value={JSON.stringify({ listingSelector, titleSelector, companySelector, locationSelector }, null, 2)}
            readOnly
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
              disabled={testPortal.isPending || !baseUrl}
              onClick={async () => {
                try {
                  await testPortal.mutateAsync({
                    baseUrl,
                    scrapeMethod: "selector",
                    scrapeConfig: { listingSelector, titleSelector, companySelector, locationSelector }
                  });
                  toast({ title: "Test complete", description: "Preview loaded below." });
                } catch (error: any) {
                  toast({
                    title: "Test failed",
                    description: error?.response?.data?.error ?? error?.message ?? "Could not test this portal.",
                    variant: "destructive"
                  });
                }
              }}
            >
              {testPortal.isPending ? "Testing..." : "Run test scrape"}
            </Button>
            <Button
              className="bg-[#6366f1] hover:bg-[#5558e6]"
              disabled={createPortal.isPending || !name || !displayName || !baseUrl}
              onClick={async () => {
                try {
                  await createPortal.mutateAsync({
                    name,
                    displayName,
                    baseUrl,
                    scrapeMethod: "selector",
                    scrapeConfig: { listingSelector, titleSelector, companySelector, locationSelector }
                  });
                  toast({ title: "Portal saved", description: `${displayName} is now available.` });
                  setName("");
                  setDisplayName("");
                  setBaseUrl("");
                } catch (error: any) {
                  toast({
                    title: "Save failed",
                    description: error?.response?.data?.error ?? error?.message ?? "Could not save this portal.",
                    variant: "destructive"
                  });
                }
              }}
            >
              {createPortal.isPending ? "Saving..." : "Save portal"}
            </Button>
          </div>
          {sampleRows.length ? (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Apply URL</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row: any) => (
                    <tr key={row.externalId} className="border-t border-white/10">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.company}</td>
                      <td className="px-3 py-2">{row.location}</td>
                      <td className="px-3 py-2 text-indigo-300">{row.applyUrl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {(customPortalsQ.data?.data ?? []).map((portal: any) => (
          <Card key={portal.id} className="card-cinematic">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{portal.displayName}</div>
                  <div className="text-sm text-white/60">{portal.baseUrl}</div>
                </div>
                <Badge className={portal.isActive ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70"}>
                  {portal.isActive ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="text-sm text-white/65">Scrape method: {portal.scrapeMethod}</div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => togglePortal.mutate(portal.id)}
                >
                  {portal.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    deletePortal.mutate(portal.id, {
                      onSuccess: () => toast({ title: "Deleted", description: `${portal.displayName} removed.` })
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
