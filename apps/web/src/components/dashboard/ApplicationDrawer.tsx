"use client";

import Image from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScoreMeter } from "@/components/shared/ScoreMeter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";

export function ApplicationDrawer({
  open,
  onOpenChange,
  application
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  application: any | null;
}) {
  const job = application?.job;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl bg-[#0b1224] border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{job?.title ?? "Application"}</SheetTitle>
        </SheetHeader>
        {application ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-white/80">{job?.company}</div>
              <Badge variant="outline" className="border-white/10 text-white/70">
                {job?.portalName}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <ScoreMeter score={application.matchScore ?? 0} />
              <StatusBadge status={application.status} />
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-2">
              <div className="font-semibold">Match reasons</div>
              <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
                {(application.matchReasons ?? []).map((r: string) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            {(application.missingSkills ?? []).length ? (
              <div className="space-y-2">
                <div className="font-semibold">Missing skills</div>
                <div className="flex flex-wrap gap-2">
                  {(application.missingSkills ?? []).slice(0, 18).map((s: string) => (
                    <Badge key={s} variant="outline" className="border-white/10 text-white/70">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {(application.screenshotBefore || application.screenshotAfter) ? (
              <div className="space-y-2">
                <div className="font-semibold">Screenshots</div>
                <div className="grid grid-cols-2 gap-3">
                  {application.screenshotBefore ? (
                    <ScreenshotCard title="Before" b64={application.screenshotBefore} />
                  ) : null}
                  {application.screenshotAfter ? (
                    <ScreenshotCard title="After" b64={application.screenshotAfter} />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="font-semibold">Job description</div>
              <div className="text-sm text-white/75 whitespace-pre-wrap max-h-64 overflow-y-auto rounded-md border border-white/10 bg-white/5 p-3">
                {job?.description ?? ""}
              </div>
            </div>

            <div className="flex justify-end">
              <Button asChild className="bg-[#6366f1] hover:bg-[#5558e6]">
                <a href={job?.applyUrl ?? "#"} target="_blank" rel="noreferrer">
                  View Job
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-sm text-white/70">No application selected.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScreenshotCard({ title, b64 }: { title: string; b64: string }) {
  const src = `data:image/png;base64,${b64}`;
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2">
      <div className="text-xs text-white/60 mb-2">{title}</div>
      <Image src={src} alt={title} width={600} height={400} className="rounded-md w-full h-auto" />
    </div>
  );
}

