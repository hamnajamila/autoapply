export type AgentStatus = {
  enabled: boolean;
  lastRun?: string | null;
  nextRun?: string | null;
  currentlyRunning: boolean;
  lastRunStats?: {
    scraped: number;
    matched: number;
    applied: number;
    failed: number;
  } | null;
};

