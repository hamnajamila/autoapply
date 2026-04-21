"use client";

import { create } from "zustand";

type AgentState = {
  enabled: boolean;
  lastRun: string | null;
  setEnabled: (enabled: boolean) => void;
  setLastRun: (lastRun: string | null) => void;
};

export const useAgentStore = create<AgentState>((set) => ({
  enabled: false,
  lastRun: null,
  setEnabled: (enabled) => set({ enabled }),
  setLastRun: (lastRun) => set({ lastRun })
}));

