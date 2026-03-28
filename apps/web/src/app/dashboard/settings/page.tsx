"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAgentStatus, usePauseAgent, useStartAgent } from "@/hooks/useAgent";
import { toast } from "@/hooks/use-toast";

const SCHEDULE_OPTIONS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Custom cron", value: "__custom__" }
] as const;

export default function SettingsPage() {
  const profileQ = useProfile();
  const update = useUpdateProfile();
  const agentQ = useAgentStatus();
  const start = useStartAgent();
  const pause = usePauseAgent();

  const [threshold, setThreshold] = useState(70);
  const [schedule, setSchedule] = useState("0 */2 * * *");
  const [schedulePreset, setSchedulePreset] = useState<string>("0 */2 * * *");
  const [maxPerRun, setMaxPerRun] = useState("20");
  const [blocked, setBlocked] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    const u = profileQ.data;
    if (!u) return;
    setThreshold(u.matchThreshold ?? 70);
    const nextSchedule = u.agentSchedule ?? "0 */2 * * *";
    setSchedule(nextSchedule);
    setSchedulePreset(SCHEDULE_OPTIONS.some((option) => option.value === nextSchedule) ? nextSchedule : "__custom__");
    setEmailNotifications(Boolean(u.emailNotifications));
    const prefs = u.preferences ?? {};
    const blockedCompanies = Array.isArray(prefs.blockedCompanies) ? prefs.blockedCompanies : [];
    setBlocked(blockedCompanies.join("\n"));
    setMaxPerRun(String(prefs.maxApplicationsPerRun ?? 20));
  }, [profileQ.data]);

  const enabled = Boolean(agentQ.data?.enabled);

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Settings</div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Agent settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Agent status</div>
              <div className="text-sm text-white/70">{enabled ? "Running" : "Paused"}</div>
            </div>
            <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={() => (enabled ? pause.mutate() : start.mutate())}>
              {enabled ? "Pause" : "Start"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="font-semibold">Match threshold</div>
            <div className="flex items-center gap-3">
              <div className="w-full">
                <Slider value={[threshold]} min={50} max={95} step={1} onValueChange={(v) => setThreshold(v[0] ?? 70)} />
              </div>
              <div className="w-14 text-right font-semibold">{threshold}</div>
            </div>
            <div className="text-xs text-white/60">Only jobs at or above this score will be queued for application.</div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-white/60">Run schedule</div>
              <Select
                value={schedulePreset}
                onValueChange={(value) => {
                  setSchedulePreset(value);
                  if (value !== "__custom__") {
                    setSchedule(value);
                  }
                }}
              >
                <SelectTrigger className="border-white/10 bg-white/5">
                  <SelectValue placeholder="Choose a schedule" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0b1224] text-white">
                  {SCHEDULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schedulePreset === "__custom__" ? (
                <>
                  <Input className="bg-white/5 border-white/10" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
                  <div className="text-xs text-white/60">Cron example: `0 */2 * * *` runs every 2 hours.</div>
                </>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Max applications per run</div>
              <Input className="bg-white/5 border-white/10" value={maxPerRun} onChange={(e) => setMaxPerRun(e.target.value)} />
              <div className="text-xs text-white/60">Keeps each automation cycle controlled and easier to audit.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-white/60">Blocked companies</div>
            <Textarea className="bg-white/5 border-white/10" value={blocked} onChange={(e) => setBlocked(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Email notifications</div>
            <div className="text-sm text-white/70">Receive an email for every apply attempt.</div>
          </div>
          <Checkbox checked={emailNotifications} onCheckedChange={(v) => setEmailNotifications(Boolean(v))} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="bg-[#6366f1] hover:bg-[#5558e6]"
          disabled={update.isPending}
          onClick={async () => {
            try {
              const prefs = {
                ...(profileQ.data?.preferences ?? {}),
                blockedCompanies: blocked
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter(Boolean),
                maxApplicationsPerRun: Number(maxPerRun) || 20
              };
              await update.mutateAsync({
                preferences: prefs,
                matchThreshold: threshold,
                agentSchedule: schedule,
                emailNotifications
              });
              toast({ title: "Saved", description: "Settings updated." });
            } catch (err: any) {
              toast({
                title: "Save failed",
                description: err?.response?.data?.error ?? err?.message ?? "Could not save settings",
                variant: "destructive"
              });
            }
          }}
        >
          {update.isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

