"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgentStatus, usePauseAgent, useStartAgent } from "@/hooks/useAgent";

export function AgentStatusBanner() {
  const statusQ = useAgentStatus();
  const start = useStartAgent();
  const pause = usePauseAgent();
  const enabled = Boolean(statusQ.data?.enabled);

  return (
    <Card
      className={
        enabled
          ? "card-cinematic border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent"
          : "card-cinematic border-amber-500/25 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent"
      }
    >
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="font-semibold text-white">{enabled ? "Agent is active" : "Agent is paused"}</div>
          <div className="text-sm text-slate-200/80">
            {enabled ? "The agent will run on your schedule." : "Start the agent to begin scraping, matching, and applying."}
          </div>
        </div>
        <Button
          onClick={() => (enabled ? pause.mutate() : start.mutate())}
          className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
        >
          {enabled ? "Pause" : "Start"}
        </Button>
      </CardContent>
    </Card>
  );
}

