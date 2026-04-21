"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCustomPortals() {
  return useQuery({
    queryKey: ["custom-portals"],
    queryFn: async () => (await api.get("/api/custom-portals")).data
  });
}

export function useTestCustomPortal() {
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/api/custom-portals/test", payload)).data
  });
}

export function useCreateCustomPortalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/api/custom-portals", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-portals"] });
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    }
  });
}

export function useUpdateCustomPortalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: any) => (await api.put(`/api/custom-portals/${id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-portals"] });
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    }
  });
}

export function useToggleCustomPortalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/api/custom-portals/${id}/toggle`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-portals"] });
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    }
  });
}

export function useDeleteCustomPortalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/custom-portals/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-portals"] });
      queryClient.invalidateQueries({ queryKey: ["portals"] });
    }
  });
}
