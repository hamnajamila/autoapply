"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGovJobAlertConfig, useGovJobs, useGovJobStats, useRefreshGovJobs, useSaveGovJobAlertConfig, useUpdateGovJobStatus } from "@/hooks/useGovJobs";
import { toast } from "@/hooks/use-toast";

export default function GovJobsPage() {
  const [keyword, setKeyword] = useState("");
  const [alertKeywords, setAlertKeywords] = useState("");
  const jobsQ = useGovJobs({ page: 1, limit: 25, keyword: keyword || undefined });
  const statsQ = useGovJobStats();
  const alertConfigQ = useGovJobAlertConfig();
  const saveAlertConfig = useSaveGovJobAlertConfig();
  const updateStatus = useUpdateGovJobStatus();
  const refresh = useRefreshGovJobs();

  useEffect(() => {
    const keywords = alertConfigQ.data?.keywords;
    if (Array.isArray(keywords)) {
      setAlertKeywords(keywords.join(", "));
    }
  }, [alertConfigQ.data?.keywords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Pakistan Government Jobs</h1>
          <p className="text-sm text-white/65">Government-like opportunities detected from the current listings plus saved alert preferences.</p>
        </div>
        <div className="flex gap-3">
          <Input className="w-72 border-white/10 bg-white/5" placeholder="Search title, company, department" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-white hover:bg-white/10"
            onClick={async () => {
              const result = await refresh.mutateAsync();
              toast({ title: "Refresh complete", description: result.message });
            }}
          >
            Refresh now
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Total Jobs", statsQ.data?.total ?? 0],
          ["New Today", statsQ.data?.newToday ?? 0],
          ["Sources Active", statsQ.data?.sourcesActive ?? 0]
        ].map(([label, value]) => (
          <Card key={label} className="card-cinematic">
            <CardContent className="space-y-1 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
              <div className="text-2xl font-semibold text-white">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-cinematic">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold text-white">Alert configuration</div>
          <Input
            className="border-white/10 bg-white/5"
            placeholder="Keywords to watch, comma separated"
            value={alertKeywords}
            onChange={(event) => setAlertKeywords(event.target.value)}
          />
          <Button
            className="bg-[#6366f1] hover:bg-[#5558e6]"
            disabled={saveAlertConfig.isPending}
            onClick={async () => {
              await saveAlertConfig.mutateAsync({
                keywords: alertKeywords.split(",").map((item) => item.trim()).filter(Boolean)
              });
              toast({ title: "Alert config saved", description: "Government job preferences updated." });
            }}
          >
            Save alert config
          </Button>
        </CardContent>
      </Card>

      <Card className="card-cinematic">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Company / Department</th>
                <th className="px-4 py-3">Portal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(jobsQ.data?.data ?? []).map((job: any) => (
                <tr key={job.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{job.title}</td>
                  <td className="px-4 py-3 text-white/70">{job.company}</td>
                  <td className="px-4 py-3 text-white/70">{job.portalName}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-white/10 bg-[#0b1224] px-3 py-2 text-white"
                      value={job.status}
                      onChange={(event) =>
                        updateStatus.mutate(
                          { id: job.id, status: event.target.value },
                          {
                            onSuccess: () => toast({ title: "Status updated", description: `${job.title} marked as ${event.target.value}.` })
                          }
                        )
                      }
                    >
                      {["Not Applied", "Applied", "Test Scheduled", "Interview", "Not Interested"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <a href={job.applyUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
                      Open listing
                    </a>
                  </td>
                </tr>
              ))}
              {!(jobsQ.data?.data ?? []).length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/55">
                    No government-style listings detected yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
