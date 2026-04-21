"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useApplications(params: Record<string, any>) {
  return useQuery({
    queryKey: ["applications", params],
    queryFn: async () => (await api.get("/api/applications", { params })).data
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: ["application", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get(`/api/applications/${id}`)).data
  });
}

