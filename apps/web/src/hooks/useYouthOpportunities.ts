"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useYouthOpportunities(params: Record<string, any>) {
  return useQuery({
    queryKey: ["youth-opportunities", params],
    queryFn: async () => (await api.get("/api/youth", { params })).data
  });
}

export function useYouthStats() {
  return useQuery({
    queryKey: ["youth-stats"],
    queryFn: async () => (await api.get("/api/youth/stats")).data
  });
}

export function useUpdateYouthKeywords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keywords: string[]) => (await api.put("/api/youth/keywords", { keywords })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youth-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["youth-stats"] });
    }
  });
}

export function useApplyYouthOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/youth/apply/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    }
  });
}
