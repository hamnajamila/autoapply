import type { UserProfile, UserPreferences } from "./Profile";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  matchThreshold: number;
  agentEnabled: boolean;
  agentSchedule: string;
  lastAgentRun?: string | null;
  emailNotifications: boolean;
  profileJson?: UserProfile | null;
  preferences?: UserPreferences | null;
  createdAt: string;
  updatedAt: string;
};

