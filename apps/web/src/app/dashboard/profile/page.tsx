"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useProfile, useUpdateProfile, useUploadResume } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const profileQ = useProfile();
  const update = useUpdateProfile();
  const upload = useUploadResume();

  const initial = profileQ.data?.profileJson ?? null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [skillsText, setSkillsText] = useState("");

  useEffect(() => {
    if (!initial) {
      return;
    }

    setName(initial.name ?? "");
    setEmail(initial.email ?? "");
    setPhone(initial.phone ?? "");
    setLocation(initial.location ?? "");
    setSummary(initial.summary ?? "");
    setSkillsText((initial.skills ?? []).join(", "));
  }, [initial]);

  const skills = useMemo(
    () =>
      skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 200),
    [skillsText]
  );

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Profile</div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-base">Resume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-white/70">
            Current file: {profileQ.data?.resumeFileUrl ? String(profileQ.data.resumeFileUrl).split(/[\\/]/).pop() : "Not available"}
          </div>
          <Input
            type="file"
            accept=".pdf,.docx"
            className="border-white/10 bg-white/5"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                return;
              }

              upload.mutate(file, {
                onSuccess: () => toast({ title: "Resume uploaded", description: "Profile updated from resume." }),
                onError: (err: any) =>
                  toast({
                    title: "Upload failed",
                    description: err?.response?.data?.error ?? err?.message ?? "Could not upload resume",
                    variant: "destructive"
                  })
              });
            }}
          />
          {upload.isPending ? <div className="text-sm text-white/70">Uploading and parsing...</div> : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-base">Profile editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-white/60">Name</div>
              <Input className="border-white/10 bg-white/5" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Email</div>
              <Input className="border-white/10 bg-white/5" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Phone</div>
              <Input className="border-white/10 bg-white/5" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Location</div>
              <Input className="border-white/10 bg-white/5" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/60">Professional summary</div>
            <Textarea className="border-white/10 bg-white/5" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-white/60">Skills (comma-separated)</div>
            <Input className="border-white/10 bg-white/5" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {skills.slice(0, 30).map((skill) => (
                <Badge key={skill} variant="outline" className="border-white/10 text-white/70">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <Button
            className="bg-[#6366f1] hover:bg-[#5558e6]"
            disabled={update.isPending}
            onClick={async () => {
              try {
                const next = {
                  ...(initial ?? {}),
                  name,
                  email,
                  phone: phone || undefined,
                  location: location || undefined,
                  summary,
                  skills
                };
                await update.mutateAsync({ profile: next });
                toast({ title: "Saved", description: "Profile changes saved." });
              } catch (err: any) {
                toast({
                  title: "Save failed",
                  description: err?.response?.data?.error ?? err?.message ?? "Could not save profile",
                  variant: "destructive"
                });
              }
            }}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
