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
    <Card className={enabled ? "bg-emerald-600/10 border-emerald-500/20" : "bg-amber-600/10 border-amber-500/20"}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">{enabled ? "Agent is active" : "Agent is paused"}</div>
          <div className="text-sm text-white/70">
            {enabled ? "The agent will run on your schedule." : "Start the agent to begin scraping, matching, and applying."}
          </div>
        </div>
        <Button onClick={() => (enabled ? pause.mutate() : start.mutate())} className="bg-[#6366f1] hover:bg-[#5558e6]">
          {enabled ? "Pause" : "Start"}
        </Button>
      </CardContent>
    </Card>
  );
}

