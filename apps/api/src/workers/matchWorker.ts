import { Worker } from "bullmq";
import type { UserProfile } from "@autoapply/shared";
import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { scoreJobMatch } from "../services/llm/jobMatcher";
import { scoreListingRelevance } from "../services/llm/resumeKeywords";
import { enqueueApply, type MatchJobData } from "./queues";
import { sanitizeText } from "../utils/text";

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
      const cleanedDescription = sanitizeText(jobRec.description);
      const relevanceScore = scoreListingRelevance(
        {
          title: jobRec.title,
          company: jobRec.company,
          location: jobRec.location,
          description: cleanedDescription,
          tags: jobRec.tags
        },
        profile
      );
      if (relevanceScore < 8) {
        await prisma.application.create({
          data: {
            userId,
            jobId,
            matchScore: 0,
            matchReasons: ["Profile relevance gate rejected this role before LLM scoring."],
            missingSkills: [],
            status: "SKIPPED_THRESHOLD",
            skipReason: "irrelevant_to_profile"
          }
        });
        return;
      }
      const result = await scoreJobMatch(profile, cleanedDescription, jobRec.title);
      const relevanceToHundred = Math.min(100, relevanceScore * 4);
      let fusedScore = Math.max(
        result.score,
        Math.round(result.score * 0.6 + relevanceToHundred * 0.4)
      );
      if (relevanceScore >= 20 && fusedScore < user.matchThreshold) {
        fusedScore = user.matchThreshold;
      }

      const app = await prisma.application.create({
        data: {
          userId,
          jobId,
          matchScore: fusedScore,
          matchReasons: [
            ...result.reasons.slice(0, 7),
            `Relevance gate score: ${relevanceScore}`
          ],
          missingSkills: result.missingSkills.slice(0, 20),
          status: fusedScore >= user.matchThreshold ? "PENDING" : "SKIPPED_THRESHOLD",
          skipReason: fusedScore >= user.matchThreshold ? null : "below_threshold"
        }
      });

      job.updateProgress(60).catch(() => undefined);

      if (fusedScore >= user.matchThreshold) {
        await enqueueApply({ userId, applicationId: app.id });
      }
      job.updateProgress(100).catch(() => undefined);
    } catch (err) {
      await logError("matchWorker", err, { userId, jobId });
    }
  },
  { connection: redis, concurrency: 10 }
);

