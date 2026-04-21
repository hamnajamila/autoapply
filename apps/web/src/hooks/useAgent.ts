"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export function useAgentStatus() {
  return useQuery({
    queryKey: ["agent-status"],
    queryFn: async () => (await api.get("/api/agent/status")).data,
    refetchInterval: 30_000
  });
}

export function useStartAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/agent/start")).data,
    onSuccess: () => {
      toast({ title: "Agent started", description: "Agent is now running in the background." });
      qc.invalidateQueries({ queryKey: ["agent-status"] });
    },
    onError: (err: any) =>
      toast({
        title: "Start failed",
        description: err?.response?.data?.error ?? err?.message ?? "Could not start agent",
        variant: "destructive"
      })
  });
}

export function usePauseAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/agent/pause")).data,
    onSuccess: () => {
      toast({ title: "Agent paused", description: "Agent has been paused." });
      qc.invalidateQueries({ queryKey: ["agent-status"] });
    },
    onError: (err: any) =>
      toast({
        title: "Pause failed",
        description: err?.response?.data?.error ?? err?.message ?? "Could not pause agent",
        variant: "destructive"
      })
  });
}

