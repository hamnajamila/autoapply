"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAnswerStore(params: Record<string, any>) {
  return useQuery({
    queryKey: ["answer-store", params],
    queryFn: async () => (await api.get("/api/answer-store", { params })).data
  });
}

export function useCreateAnswerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/api/answer-store", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["answer-store"] })
  });
}

export function useUpdateAnswerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: any) => (await api.put(`/api/answer-store/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["answer-store"] })
  });
}

export function useDeleteAnswerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/answer-store/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["answer-store"] })
  });
}

export function usePopulateAnswerStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/answer-store/populate")).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["answer-store"] })
  });
}
