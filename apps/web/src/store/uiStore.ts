"use client";

import { create } from "zustand";

type UIState = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v })
}));

