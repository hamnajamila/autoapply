import { Worker } from "bullmq";
import type { JobListing, UserProfile } from "@autoapply/shared";
import { decrypt } from "@autoapply/shared";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { PortalRegistry } from "../services/portals/PortalRegistry";
import { enqueueMatch, type ScrapeJobData } from "./queues";
import { rankListingsForProfile } from "../services/llm/resumeKeywords";

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

async function upsertJobs(jobs: JobListing[]) {
  const created: string[] = [];
  for (const j of jobs) {
    try {
      const existing = await prisma.job.findUnique({
        where: { portalName_externalId: { portalName: j.portalName, externalId: j.externalId } },
        select: { id: true }
      });
      if (existing) continue;
      const rec = await prisma.job.create({
        data: {
          portalName: j.portalName,
          externalId: j.externalId,
          title: j.title,
          company: j.company,
          companyLogoUrl: j.companyLogoUrl ?? null,
          location: j.location ?? "Remote",
          description: j.description,
          applyUrl: j.applyUrl,
          salaryMin: j.salaryMin ?? null,
          salaryMax: j.salaryMax ?? null,
          salaryCurrency: j.salaryCurrency ?? null,
          jobType: j.jobType ?? null,
          tags: j.tags ?? [],
          isRemote: j.isRemote,
          postedAt: j.postedAt ? new Date(j.postedAt) : null
        }
      });
      created.push(rec.id);
    } catch (err) {
      await logError("scrapeWorker.upsertJobs", err, { portal: j.portalName, externalId: j.externalId });
    }
  }
  return created;
}

export const scrapeWorker = new Worker<ScrapeJobData>(
  "scrape-queue",
  async (job) => {
    const { userId, portalName } = job.data;
    job.updateProgress(1).catch(() => undefined);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileJson: true, portalCredentials: { where: { portalName, isActive: true } } }
    });
    if (!user) return;

    const cred = user.portalCredentials[0];
    const portal = PortalRegistry.get(portalName);

    try {
      await portal.initBrowser(cred?.cookiesJson ?? undefined);
      if (portal.requiresAuth) {
        const encrypted = cred?.encryptedData ?? "";
        if (!encrypted) throw new Error("missing_portal_credentials");
        const ok = await portal.isLoggedIn().catch(() => false);
        if (!ok) {
          const credentials = JSON.parse(decrypt(encrypted, env.ENCRYPTION_KEY)) as Record<string, string>;
          await portal.login(credentials);
          const loggedIn = await portal.isLoggedIn().catch(() => false);
          if (!loggedIn) throw new Error("not_logged_in");
        }
      }

      const profile = user.profileJson as UserProfile | undefined;
      const listings = rankListingsForProfile(await portal.scrapeJobs(profile), profile);
      const newJobIds = await upsertJobs(listings);

      job.updateProgress(60).catch(() => undefined);
      for (const jobId of newJobIds) {
        await enqueueMatch({ userId, jobId });
      }

      if (cred) {
        const cookiesJson = await portal.saveCookies().catch(() => cred.cookiesJson ?? "[]");
        await prisma.portalCredential.update({
          where: { userId_portalName: { userId, portalName } },
          data: { cookiesJson, lastSynced: new Date(), lastError: null }
        });
      }
      job.updateProgress(100).catch(() => undefined);
    } catch (err) {
      await logError("scrapeWorker", err, { userId, portalName });
      if (cred) {
        await prisma.portalCredential.update({
          where: { userId_portalName: { userId, portalName } },
          data: { lastError: err instanceof Error ? err.message : String(err), lastSynced: new Date() }
        });
      }
    } finally {
      await portal.closeBrowser().catch(() => undefined);
    }
  },
  { connection: redis, concurrency: 3 }
);

