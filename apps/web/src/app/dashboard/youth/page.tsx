"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useApplyYouthOpportunity, useUpdateYouthKeywords, useYouthOpportunities, useYouthStats } from "@/hooks/useYouthOpportunities";
import { toast } from "@/hooks/use-toast";

export default function YouthPage() {
  const [keywordFilter, setKeywordFilter] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const youthQ = useYouthOpportunities({ page: 1, limit: 18, keyword: keywordFilter || undefined });
  const statsQ = useYouthStats();
  const applyYouth = useApplyYouthOpportunity();
  const updateKeywords = useUpdateYouthKeywords();

  const keywords = useMemo(() => statsQ.data?.keywords ?? [], [statsQ.data?.keywords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Youth Opportunities Hub</h1>
          <p className="text-sm text-white/65">Internships, fellowships, scholarships, and early-career roles derived from the jobs you already scrape.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input className="w-72 border-white/10 bg-white/5" placeholder="Search keyword" value={keywordFilter} onChange={(event) => setKeywordFilter(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total Listed", statsQ.data?.total ?? 0],
          ["Internships", statsQ.data?.internships ?? 0],
          ["Fellowships", statsQ.data?.fellowships ?? 0],
          ["Hackathons", statsQ.data?.hackathons ?? 0],
          ["Scholarships", statsQ.data?.scholarships ?? 0],
          ["Competitions", statsQ.data?.competitions ?? 0]
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
          <div className="text-sm font-semibold text-white">Youth keywords</div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword: string) => (
              <Badge key={keyword} className="bg-indigo-500/20 text-indigo-100">
                {keyword}
              </Badge>
            ))}
          </div>
          <div className="flex gap-3">
            <Input
              className="border-white/10 bg-white/5"
              placeholder="Update keywords, comma separated"
              value={keywordsInput}
              onChange={(event) => setKeywordsInput(event.target.value)}
            />
            <Button
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
              onClick={async () => {
                const nextKeywords = keywordsInput
                  .split(",")
                  .map((keyword) => keyword.trim())
                  .filter(Boolean);
                if (!nextKeywords.length) return;
                await updateKeywords.mutateAsync(nextKeywords);
                setKeywordsInput("");
                toast({ title: "Keywords updated", description: "Youth opportunity filters saved." });
              }}
            >
              Save keywords
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(youthQ.data?.data ?? []).map((item: any) => (
          <Card key={item.id} className="card-cinematic">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{item.title}</div>
                  <div className="text-sm text-white/60">{item.company}</div>
                </div>
                <Badge className="bg-sky-500/20 text-sky-100">{item.type}</Badge>
              </div>
              <div className="line-clamp-4 text-sm text-white/70">{item.description}</div>
              <div className="flex flex-wrap gap-2">
                {(item.tags ?? []).slice(0, 6).map((tag: string) => (
                  <Badge key={tag} variant="outline" className="border-white/10 text-white/70">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  className="bg-[#6366f1] hover:bg-[#5558e6]"
                  disabled={applyYouth.isPending}
                  onClick={async () => {
                    await applyYouth.mutateAsync(item.id);
                    toast({ title: "Queued", description: "This opportunity has been queued for matching/apply." });
                  }}
                >
                  Apply now
                </Button>
                <a href={item.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-indigo-300 hover:text-indigo-200">
                  Open source
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
