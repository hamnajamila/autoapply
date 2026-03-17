import { Router } from "express";
import cron from "node-cron";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { AgentOrchestrator } from "../services/agent/AgentOrchestrator";

const router = Router();

function nextRunFromCron(_cronExpr: string): string | null {
  // Computing next run for arbitrary cron with timezone is non-trivial without extra deps.
  // We return null and let the UI show "scheduled".
  return null;
}

router.post("/start", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.update({ where: { id: userId }, data: { agentEnabled: true } });
    if (!cron.validate(user.agentSchedule)) {
      await prisma.user.update({ where: { id: userId }, data: { agentSchedule: "0 */2 * * *" } });
    }
    const orchestrator = new AgentOrchestrator();
    void orchestrator.runForUser(userId);
    return res.json({ status: "started" });
  } catch (err) {
    return next(err);
  }
});

router.post("/pause", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    await prisma.user.update({ where: { id: userId }, data: { agentEnabled: false } });
    return res.json({ status: "paused" });
  } catch (err) {
    return next(err);
  }
});

router.get("/status", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agentEnabled: true, lastAgentRun: true, agentSchedule: true }
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({
      enabled: user.agentEnabled,
      lastRun: user.lastAgentRun?.toISOString() ?? null,
      nextRun: user.agentEnabled ? nextRunFromCron(user.agentSchedule) : null,
      currentlyRunning: false,
      lastRunStats: null
    });
  } catch (err) {
    return next(err);
  }
});

export default router;

