"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get("/api/profile")).data
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.put("/api/profile", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] })
  });
}

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/api/profile/resume", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] })
  });
}

