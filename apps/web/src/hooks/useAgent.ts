"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-status"] })
  });
}

export function usePauseAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/agent/pause")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-status"] })
  });
}

