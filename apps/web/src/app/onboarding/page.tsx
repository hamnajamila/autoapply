"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadResume, useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { usePortals, useConnectPortal } from "@/hooks/usePortals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function StepIndicator({ step }: { step: number }) {
  const percentage = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/70">Step {step} of 3</div>
      <Progress value={percentage} className="bg-white/10" />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const profileQ = useProfile();
  const upload = useUploadResume();
  const update = useUpdateProfile();
  const portalsQ = usePortals();
  const connect = useConnectPortal();

  const profile = profileQ.data?.profileJson ?? null;

  const [threshold, setThreshold] = useState(70);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [jobTypes, setJobTypes] = useState<Record<string, boolean>>({
    "Full-time": true,
    "Part-time": false,
    Contract: false,
    Freelance: false
  });
  const [blockedCompanies, setBlockedCompanies] = useState("");
  const [schedule, setSchedule] = useState("0 */2 * * *");

  const scheduleOptions = useMemo(
    () => [
      { label: "Every 1 hour", value: "0 * * * *" },
      { label: "Every 2 hours", value: "0 */2 * * *" },
      { label: "Every 6 hours", value: "0 */6 * * *" },
      { label: "Every 12 hours", value: "0 */12 * * *" },
      { label: "Daily", value: "0 0 * * *" }
    ],
    []
  );

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get("token");
    const token = urlToken || localStorage.getItem("autoapply_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    localStorage.setItem("autoapply_token", token);
    if (urlToken) {
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [router]);

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">Onboarding</div>
          <div className="text-sm text-white/70">Set up AutoApply in a few minutes.</div>
        </div>
        <div className="w-56">
          <StepIndicator step={step} />
        </div>
      </div>

      {step === 1 ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Step 1 - Upload your resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-white/70">Upload a PDF or DOCX (max 10MB). We&apos;ll parse it and generate an editable profile.</div>
            <Input
              type="file"
              accept=".pdf,.docx"
              className="border-white/10 bg-white/5"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  upload.mutate(file);
                }
              }}
            />
            {upload.isPending ? <div className="text-sm text-white/70">Parsing your resume with AI...</div> : null}
            {profile ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-white/60">Name</div>
                  <Input className="border-white/10 bg-white/5" defaultValue={profile.name ?? ""} readOnly />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-white/60">Email</div>
                  <Input className="border-white/10 bg-white/5" defaultValue={profile.email ?? ""} readOnly />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="text-xs text-white/60">Skills</div>
                  <div className="flex flex-wrap gap-2">
                    {(profile.skills ?? []).slice(0, 24).map((skill: string) => (
                      <Badge key={skill} variant="outline" className="border-white/10 text-white/80">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button className="bg-[#6366f1] hover:bg-[#5558e6]" disabled={!profile} onClick={() => setStep(2)}>
                Looks good, next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Step 2 - Connect job portals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(portalsQ.data?.portals ?? []).map((portal: any) => (
                <Card key={portal.name} className="border-white/10 bg-white/5">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{portal.displayName}</div>
                      <Badge className={portal.connected ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70"}>
                        {portal.connected ? "Connected" : "Not connected"}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/60">{portal.description}</div>
                    {portal.name === "linkedin" ? (
                      <Button
                        className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                        onClick={() => {
                          window.location.href = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/auth/linkedin`;
                        }}
                      >
                        Connect with LinkedIn
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
                            portalName={portal.name}
                            onSave={async (credentials) => {
                              await connect.mutateAsync({ portalName: portal.name, credentials });
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                {"<-"} Back
              </Button>
              <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Step 3 - Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="font-semibold">Match threshold</div>
              <div className="text-sm text-white/70">Auto-apply only when your match score meets or exceeds this value.</div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <Slider value={[threshold]} min={50} max={95} step={1} onValueChange={(value) => setThreshold(value[0] ?? 70)} />
                </div>
                <div className="w-14 text-right font-semibold">{threshold}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs text-white/60">Salary min</div>
                <Input className="border-white/10 bg-white/5" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/60">Salary max</div>
                <Input className="border-white/10 bg-white/5" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/60">Currency</div>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0b1224] text-white">
                    {["USD", "EUR", "GBP", "CAD", "AUD", "INR"].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Job types</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.keys(jobTypes).map((jobType) => (
                  <label key={jobType} className="flex items-center gap-2 text-sm text-white/80">
                    <Checkbox
                      checked={Boolean(jobTypes[jobType])}
                      onCheckedChange={(value) => setJobTypes((current) => ({ ...current, [jobType]: Boolean(value) }))}
                    />
                    {jobType}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold">Blocked companies</div>
              <div className="text-sm text-white/70">One per line.</div>
              <Textarea className="border-white/10 bg-white/5" value={blockedCompanies} onChange={(e) => setBlockedCompanies(e.target.value)} />
            </div>

            <div className="space-y-1">
              <div className="font-semibold">Agent schedule</div>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger className="border-white/10 bg-white/5">
                  <SelectValue placeholder="Schedule" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0b1224] text-white">
                  {scheduleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                {"<-"} Back
              </Button>
              <Button
                className="bg-[#6366f1] hover:bg-[#5558e6]"
                disabled={update.isPending}
                onClick={async () => {
                  const preferences = {
                    salaryMin: salaryMin ? Number(salaryMin) : null,
                    salaryMax: salaryMax ? Number(salaryMax) : null,
                    salaryCurrency: currency,
                    jobTypes: Object.entries(jobTypes)
                      .filter(([, enabled]) => enabled)
                      .map(([name]) => name),
                    blockedCompanies: blockedCompanies
                      .split(/\r?\n/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                    remoteOnly: true,
                    scheduleCron: schedule
                  };

                  await update.mutateAsync({ preferences, matchThreshold: threshold, agentSchedule: schedule });
                  router.push("/dashboard");
                }}
              >
                Start Agent and Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PortalConnectForm({
  portalName,
  onSave
}: {
  portalName: string;
  onSave: (creds: Record<string, string>) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="text-sm text-white/70">Enter credentials for {portalName}. These are encrypted at rest.</div>
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
