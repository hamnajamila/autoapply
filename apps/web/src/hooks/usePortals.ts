"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePortals() {
  return useQuery({
    queryKey: ["portals"],
    queryFn: async () => (await api.get("/api/portals")).data
  });
}

export function useConnectPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ portalName, credentials }: { portalName: string; credentials: Record<string, string> }) =>
      (await api.post(`/api/portals/${portalName}/connect`, { credentials })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals"] })
  });
}

export function useDisconnectPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (portalName: string) => (await api.delete(`/api/portals/${portalName}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals"] })
  });
}

export function useCreateCustomPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) =>
      (await api.post("/api/portals/custom", { name, url })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals"] })
  });
}

export function useDeleteCustomPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/portals/custom/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals"] })
  });
}

