"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGovJobs(params: Record<string, any>) {
  return useQuery({
    queryKey: ["gov-jobs", params],
    queryFn: async () => (await api.get("/api/gov-jobs", { params })).data
  });
}

export function useGovJobStats() {
  return useQuery({
    queryKey: ["gov-job-stats"],
    queryFn: async () => (await api.get("/api/gov-jobs/stats")).data
  });
}

export function useGovJobAlertConfig() {
  return useQuery({
    queryKey: ["gov-job-alert-config"],
    queryFn: async () => (await api.get("/api/gov-jobs/alert-config")).data
  });
}

export function useSaveGovJobAlertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/api/gov-jobs/alert-config", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gov-job-alert-config"] })
  });
}

export function useUpdateGovJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.put(`/api/gov-jobs/${id}/status`, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gov-jobs"] })
  });
}

export function useRefreshGovJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/gov-jobs/scrape-now")).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gov-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["gov-job-stats"] });
    }
  });
}
