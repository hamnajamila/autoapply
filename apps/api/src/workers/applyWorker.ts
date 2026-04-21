import path from "node:path";
import { Worker } from "bullmq";
import type { UserProfile } from "@autoapply/shared";
import { decrypt } from "@autoapply/shared";
import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { PortalRegistry } from "../services/portals/PortalRegistry";
import { EmailService } from "../services/email/EmailService";
import type { ApplyJobData } from "./queues";

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

function detectATS(url: string): "greenhouse" | "lever" | "workday" | null {
  const u = url.toLowerCase();
  if (u.includes("boards.greenhouse.io") || u.includes("grnh.se")) return "greenhouse";
  if (u.includes("jobs.lever.co")) return "lever";
  if (u.includes("myworkdayjobs.com") || u.includes("wd1.myworkdayjobs.com")) return "workday";
  return null;
}

export const applyWorker = new Worker<ApplyJobData>(
  "apply-queue",
  async (job) => {
    const { userId, applicationId } = job.data;
    job.updateProgress(1).catch(() => undefined);

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, user: true }
    });
    if (!app || app.userId !== userId) return;

    try {
      const dup = await prisma.application.findFirst({
        where: {
          userId,
          job: { company: app.job.company, title: app.job.title, portalName: app.job.portalName },
          status: { in: ["SUBMITTED", "UNCERTAIN"] },
          NOT: { id: app.id }
        },
        select: { id: true }
      });
      if (dup) {
        await prisma.application.update({
          where: { id: app.id },
          data: { status: "SKIPPED_DUPLICATE", skipReason: "already_applied" }
        });
        return;
      }

      const ats = detectATS(app.job.applyUrl);
      const portalName = ats ?? app.job.portalName;
      const portal = PortalRegistry.get(portalName);

      const cred = await prisma.portalCredential.findUnique({
        where: { userId_portalName: { userId, portalName: app.job.portalName } }
      });

      const credentials: Record<string, string> = {};
      if (cred?.encryptedData) {
        try {
          const json = decrypt(cred.encryptedData, env.ENCRYPTION_KEY);
          Object.assign(credentials, JSON.parse(json));
        } catch (err) {
          await logError("applyWorker.decryptCredentials", err, { portalName: app.job.portalName });
        }
      }

      // Initialize browser and restore cookies for the source portal (or ATS if exists)
      const cookieSourceCred =
        (ats &&
          (await prisma.portalCredential.findUnique({
            where: { userId_portalName: { userId, portalName: ats } }
          }))) ||
        cred;

      await portal.initBrowser(cookieSourceCred?.cookiesJson ?? undefined);
      if (portal.requiresAuth) {
        const ok = await portal.isLoggedIn().catch(() => false);
        if (!ok) await portal.login(credentials);
      }

      job.updateProgress(25).catch(() => undefined);

      const resumePath = app.user.resumeFileUrl
        ? path.isAbsolute(app.user.resumeFileUrl)
          ? app.user.resumeFileUrl
          : path.join(process.cwd(), app.user.resumeFileUrl)
        : path.join(process.cwd(), env.UPLOADS_DIR, `${app.userId}.resume`);

      const profile = (app.user.profileJson ?? {}) as UserProfile;
      const result = await portal.applyToJob(
        {
          portalName: app.job.portalName,
          externalId: app.job.externalId,
          title: app.job.title,
          company: app.job.company,
          companyLogoUrl: app.job.companyLogoUrl,
          location: app.job.location,
          description: app.job.description,
          applyUrl: app.job.applyUrl,
          salaryMin: app.job.salaryMin,
          salaryMax: app.job.salaryMax,
          salaryCurrency: app.job.salaryCurrency,
          jobType: app.job.jobType,
          tags: app.job.tags,
          isRemote: app.job.isRemote,
          postedAt: app.job.postedAt?.toISOString() ?? null
        },
        profile,
        resumePath
      );

      const cookiesJson = await portal.saveCookies().catch(() => cookieSourceCred?.cookiesJson ?? "[]");
      if (cookieSourceCred) {
        await prisma.portalCredential.update({
          where: { userId_portalName: { userId, portalName: cookieSourceCred.portalName } },
          data: { cookiesJson, lastSynced: new Date(), lastError: result.success ? null : result.errorMessage ?? null }
        });
      }

      const status = result.status;
      const now = new Date();
      await prisma.application.update({
        where: { id: app.id },
        data: {
          status: status as any,
          screenshotBefore: result.screenshotBefore ?? app.screenshotBefore,
          screenshotAfter: result.screenshotAfter ?? app.screenshotAfter,
          skipReason: result.skipReason ?? app.skipReason,
          errorMessage: result.errorMessage ?? null,
          appliedAt: result.success ? now : app.appliedAt
        }
      });

      job.updateProgress(70).catch(() => undefined);

      const email = new EmailService();
      if (app.user.emailNotifications) {
        if (status === "SKIPPED_CAPTCHA") {
          await email.sendCaptchaRequired(app.user.email, app.userId, {
            jobTitle: app.job.title,
            company: app.job.company,
            jobUrl: app.job.applyUrl
          });
        } else if (result.success) {
          await email.sendApplicationSuccess(app.user.email, app.userId, {
            jobTitle: app.job.title,
            company: app.job.company,
            portalName: app.job.portalName,
            matchScore: app.matchScore,
            matchReasons: app.matchReasons,
            jobUrl: app.job.applyUrl,
            appliedAt: now.toISOString()
          });
        } else {
          await email.sendApplicationFailed(app.user.email, app.userId, {
            jobTitle: app.job.title,
            company: app.job.company,
            portalName: app.job.portalName,
            jobUrl: app.job.applyUrl,
            error: result.errorMessage ?? "Application could not be confirmed."
          });
        }
      }

      await prisma.application.update({
        where: { id: app.id },
        data: { emailSentAt: app.user.emailNotifications ? new Date() : null }
      });

      job.updateProgress(100).catch(() => undefined);
    } catch (err) {
      await logError("applyWorker", err, { userId, applicationId });
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) }
      }).catch(() => undefined);
    }
  },
  { connection: redis, concurrency: 2 }
);

