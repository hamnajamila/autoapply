"use client";

import { useEffect, useMemo, useState } from "react";
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
    if (!initial) return;
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
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200),
    [skillsText]
  );

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Profile</div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Resume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-white/70">
            Current file: {profileQ.data?.resumeFileUrl ?? "—"}
          </div>
          <Input
            type="file"
            accept=".pdf,.docx"
            className="bg-white/5 border-white/10"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
          {upload.isPending ? <div className="text-sm text-white/70">Uploading & parsing...</div> : null}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Profile editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-white/60">Name</div>
              <Input className="bg-white/5 border-white/10" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Email</div>
              <Input className="bg-white/5 border-white/10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Phone</div>
              <Input className="bg-white/5 border-white/10" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Location</div>
              <Input className="bg-white/5 border-white/10" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/60">Professional summary</div>
            <Textarea className="bg-white/5 border-white/10" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-white/60">Skills (comma-separated)</div>
            <Input className="bg-white/5 border-white/10" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {skills.slice(0, 30).map((s) => (
                <Badge key={s} variant="outline" className="border-white/10 text-white/70">
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          <Button
            className="bg-[#6366f1] hover:bg-[#5558e6]"
            disabled={update.isPending}
            onClick={async () => {
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
            }}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

