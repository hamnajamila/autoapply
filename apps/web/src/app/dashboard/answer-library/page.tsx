"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAnswerStore, useCreateAnswerEntry, useDeleteAnswerEntry, usePopulateAnswerStore } from "@/hooks/useAnswerStore";
import { toast } from "@/hooks/use-toast";

export default function AnswerLibraryPage() {
  const [category, setCategory] = useState("all");
  const [questionRaw, setQuestionRaw] = useState("");
  const [answer, setAnswer] = useState("");
  const [entryCategory, setEntryCategory] = useState("custom");
  const answersQ = useAnswerStore({ page: 1, limit: 100, category: category === "all" ? undefined : category });
  const createEntry = useCreateAnswerEntry();
  const deleteEntry = useDeleteAnswerEntry();
  const populate = usePopulateAnswerStore();

  const total = useMemo(() => answersQ.data?.total ?? 0, [answersQ.data?.total]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Answer Library</h1>
          <p className="text-sm text-white/65">Store reusable answers so repeated forms can be filled more consistently.</p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 bg-transparent text-white hover:bg-white/10"
          disabled={populate.isPending}
          onClick={async () => {
            const result = await populate.mutateAsync();
            toast({ title: "Library populated", description: `Added ${result.created ?? 0} profile-derived answers.` });
          }}
        >
          Pre-populate from profile
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {["all", "personal_info", "work_experience", "education", "compensation", "skills", "custom"].map((value) => (
          <Button
            key={value}
            variant={category === value ? "default" : "outline"}
            className={category === value ? "bg-[#6366f1] hover:bg-[#5558e6]" : "border-white/10 bg-transparent text-white hover:bg-white/10"}
            onClick={() => setCategory(value)}
          >
            {value}
          </Button>
        ))}
        <Badge className="bg-white/10 text-white/80">{total} stored</Badge>
      </div>

      <Card className="card-cinematic">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold text-white">Add answer</div>
          <Input className="border-white/10 bg-white/5" placeholder="Question" value={questionRaw} onChange={(event) => setQuestionRaw(event.target.value)} />
          <Textarea className="border-white/10 bg-white/5" placeholder="Answer" value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <div className="flex gap-3">
            <Input className="border-white/10 bg-white/5" placeholder="Category" value={entryCategory} onChange={(event) => setEntryCategory(event.target.value)} />
            <Button
              className="bg-[#6366f1] hover:bg-[#5558e6]"
              disabled={createEntry.isPending || !questionRaw || !answer}
              onClick={async () => {
                await createEntry.mutateAsync({ questionRaw, answer, category: entryCategory });
                toast({ title: "Answer saved", description: "The library entry is ready to reuse." });
                setQuestionRaw("");
                setAnswer("");
              }}
            >
              Save entry
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {(answersQ.data?.data ?? []).map((entry: any) => (
          <Card key={entry.id} className="card-cinematic">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold text-white">{entry.questionRaw}</div>
                <Badge className="bg-indigo-500/20 text-indigo-100">{entry.category}</Badge>
              </div>
              <div className="whitespace-pre-wrap text-sm text-white/75">{entry.answer}</div>
              <div className="flex items-center justify-between text-xs text-white/45">
                <div>Used {entry.usageCount ?? 0} times</div>
                <Button
                  variant="destructive"
                  onClick={() =>
                    deleteEntry.mutate(entry.id, {
                      onSuccess: () => toast({ title: "Deleted", description: "Answer entry removed." })
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
