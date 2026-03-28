import { Worker } from "bullmq";
import type { UserProfile } from "@autoapply/shared";
import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { scoreJobMatch } from "../services/llm/jobMatcher";
import { enqueueApply, type MatchJobData } from "./queues";

async function logError(context: string, err: unknown, metadata?: unknown) {
  try {
    await prisma.errorLog.create({
      data: {
        context,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
        metadata: metadata as any
      }
    });
  } catch (e) {
    logger.error("Failed to log ErrorLog", { e });
  }
}

export const matchWorker = new Worker<MatchJobData>(
  "match-queue",
  async (job) => {
    const { userId, jobId } = job.data;
    job.updateProgress(1).catch(() => undefined);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, matchThreshold: true, profileJson: true }
    });
    const jobRec = await prisma.job.findUnique({ where: { id: jobId } });
    if (!user || !jobRec) return;

    try {
      const existing = await prisma.application.findFirst({
        where: { userId, jobId },
        select: { id: true }
      });
      if (existing) return;

      const profile = (user.profileJson ?? {}) as UserProfile;
      const result = await scoreJobMatch(profile, jobRec.description, jobRec.title);

      const app = await prisma.application.create({
        data: {
          userId,
          jobId,
          matchScore: result.score,
          matchReasons: result.reasons.slice(0, 8),
          missingSkills: result.missingSkills.slice(0, 20),
          status: result.score >= user.matchThreshold ? "PENDING" : "SKIPPED_THRESHOLD",
          skipReason: result.score >= user.matchThreshold ? null : "below_threshold"
        }
      });

      job.updateProgress(60).catch(() => undefined);

      if (result.score >= user.matchThreshold) {
        await enqueueApply({ userId, applicationId: app.id });
      }
      job.updateProgress(100).catch(() => undefined);
    } catch (err) {
      await logError("matchWorker", err, { userId, jobId });
    }
  },
  { connection: redis, concurrency: 10 }
);

