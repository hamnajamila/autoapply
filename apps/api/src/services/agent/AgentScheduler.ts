import cron from "node-cron";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { AgentOrchestrator } from "./AgentOrchestrator";

type TaskEntry = { userId: string; schedule: string; task: cron.ScheduledTask };

export class AgentScheduler {
  private tasks = new Map<string, TaskEntry>();
  private refreshHandle: NodeJS.Timeout | null = null;
  private running = new Set<string>();

  start() {
    this.refresh().catch((e) => logger.error("Scheduler refresh failed", { e }));
    this.refreshHandle = setInterval(() => {
      this.refresh().catch((e) => logger.error("Scheduler refresh failed", { e }));
    }, 60_000);
  }

  stop() {
    for (const entry of this.tasks.values()) entry.task.stop();
    this.tasks.clear();
    if (this.refreshHandle) clearInterval(this.refreshHandle);
    this.refreshHandle = null;
  }

  private async refresh() {
    const enabled = await prisma.user.findMany({
      where: { agentEnabled: true },
      select: { id: true, agentSchedule: true }
    });

    const enabledIds = new Set(enabled.map((u) => u.id));

    // Remove tasks for disabled users
    for (const [userId, entry] of this.tasks.entries()) {
      if (!enabledIds.has(userId)) {
        entry.task.stop();
        this.tasks.delete(userId);
      }
    }

    // Add/update tasks
    for (const u of enabled) {
      const existing = this.tasks.get(u.id);
      if (existing && existing.schedule === u.agentSchedule) continue;
      if (existing) {
        existing.task.stop();
        this.tasks.delete(u.id);
      }
      if (!cron.validate(u.agentSchedule)) {
        logger.warn("Invalid user cron schedule; skipping", { userId: u.id, schedule: u.agentSchedule });
        continue;
      }
      const task = cron.schedule(
        u.agentSchedule,
        async () => {
          if (this.running.has(u.id)) return;
          this.running.add(u.id);
          try {
            const orchestrator = new AgentOrchestrator();
            await orchestrator.runForUser(u.id);
          } catch (err) {
            await prisma.errorLog
              .create({
                data: {
                  context: "AgentScheduler",
                  message: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack ?? null : null,
                  metadata: { userId: u.id }
                }
              })
              .catch(() => undefined);
          } finally {
            this.running.delete(u.id);
          }
        },
        { timezone: "UTC" }
      );
      this.tasks.set(u.id, { userId: u.id, schedule: u.agentSchedule, task });
      logger.info("Scheduled agent", { userId: u.id, schedule: u.agentSchedule });
    }
  }
}

