import { Router } from "express";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { readPreferences } from "../utils/userPreferences";

const router = Router();

function buildNotifications(data: {
  applications: any[];
  portalCredentials: any[];
  emailLogs: any[];
  preferences: unknown;
}) {
  const prefs = readPreferences(data.preferences);
  const readIds = new Set(Array.isArray(prefs["readNotificationIds"]) ? prefs["readNotificationIds"] : []);

  const applicationNotifications = data.applications.map((application) => ({
    id: `application:${application.id}`,
    type: "application",
    title:
      application.status === "SUBMITTED"
        ? `Applied to ${application.job.title}`
        : application.status === "FAILED"
          ? `Application failed for ${application.job.title}`
          : `Application update for ${application.job.title}`,
    body: `${application.job.company} via ${application.job.portalName}`,
    data: { applicationId: application.id, jobId: application.jobId, status: application.status },
    createdAt: application.updatedAt,
    isUrgent: application.status === "FAILED",
    isRead: readIds.has(`application:${application.id}`)
  }));

  const portalNotifications = data.portalCredentials
    .filter((credential) => credential.lastError)
    .map((credential) => ({
      id: `portal:${credential.id}`,
      type: "system",
      title: `${credential.portalName} needs attention`,
      body: credential.lastError,
      data: { portalName: credential.portalName },
      createdAt: credential.updatedAt,
      isUrgent: true,
      isRead: readIds.has(`portal:${credential.id}`)
    }));

  const emailNotifications = data.emailLogs
    .filter((emailLog) => !emailLog.success)
    .map((emailLog) => ({
      id: `email:${emailLog.id}`,
      type: "email",
      title: `Email delivery issue: ${emailLog.subject}`,
      body: emailLog.errorMessage ?? "Email provider rejected the message.",
      data: { templateName: emailLog.templateName },
      createdAt: emailLog.sentAt,
      isUrgent: false,
      isRead: readIds.has(`email:${emailLog.id}`)
    }));

  return [...applicationNotifications, ...portalNotifications, ...emailNotifications].sort(
    (left, right) => +new Date(right.createdAt) - +new Date(left.createdAt)
  );
}

async function updateReadIds(userId: string, nextReadIds: string[]) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const prefs = readPreferences(user?.preferences);
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: { ...prefs, readNotificationIds: Array.from(new Set(nextReadIds)) } as any }
  });
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const page = Number(req.query["page"] ?? 1);
    const limit = Number(req.query["limit"] ?? 20);
    const userId = req.auth!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
        applications: {
          include: { job: true },
          orderBy: { updatedAt: "desc" },
          take: 40
        },
        portalCredentials: {
          orderBy: { updatedAt: "desc" },
          take: 20
        },
        emailLogs: {
          orderBy: { sentAt: "desc" },
          take: 20
        }
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const notifications = buildNotifications(user);
    const start = (page - 1) * limit;
    return res.json({
      data: notifications.slice(start, start + limit),
      total: notifications.length,
      page,
      limit
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/unread-count", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        preferences: true,
        applications: { include: { job: true }, take: 20, orderBy: { updatedAt: "desc" } },
        portalCredentials: { take: 20, orderBy: { updatedAt: "desc" } },
        emailLogs: { take: 20, orderBy: { sentAt: "desc" } }
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const notifications = buildNotifications(user);
    return res.json({ count: notifications.filter((notification) => !notification.isRead).length });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const notificationId = String(req.params["id"]);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const current = Array.isArray(prefs["readNotificationIds"]) ? prefs["readNotificationIds"] : [];
    await updateReadIds(userId, [...current, notificationId]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/mark-all-read", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
        applications: { include: { job: true }, take: 40, orderBy: { updatedAt: "desc" } },
        portalCredentials: { take: 20, orderBy: { updatedAt: "desc" } },
        emailLogs: { take: 20, orderBy: { sentAt: "desc" } }
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const notificationIds = buildNotifications(user).map((notification) => notification.id);
    await updateReadIds(userId, notificationIds);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.put("/preferences", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, notificationPreferences: req.body ?? {} } as any }
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
