import { Router } from "express";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { PortalRegistry } from "../services/portals/PortalRegistry";

const router = Router();

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get("/stats", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const publicSourcePortals = PortalRegistry.allPortalNames()
      .map((portalName) => PortalRegistry.get(portalName))
      .filter((portal) => !portal.requiresAuth && !["greenhouse", "lever", "workday"].includes(portal.name))
      .length;

    const [totalApplications, thisWeekApps, avgScoreAgg, portalsConnected, recentApplications] = await Promise.all([
      prisma.application.count({ where: { userId, status: "SUBMITTED" } }),
      prisma.application.count({ where: { userId, status: "SUBMITTED", appliedAt: { gte: weekAgo } } }),
      prisma.application.aggregate({ where: { userId }, _avg: { matchScore: true } }),
      prisma.portalCredential.count({
        where: {
          userId,
          isActive: true,
          OR: [{ lastError: null }, { lastError: "" }]
        }
      }),
      prisma.application.findMany({
        where: { userId },
        include: { job: true },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    const apps = await prisma.application.findMany({
      where: { userId, createdAt: { gte: twoWeeksAgo } },
      include: { job: true }
    });

    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const a of apps) {
      const k = startOfDay(a.createdAt).toISOString().slice(0, 10);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }

    const byStatus = apps.reduce<Record<string, number>>((acc: Record<string, number>, a) => {
      const key = String(a.status);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const byPortal = apps.reduce<Record<string, number>>((acc: Record<string, number>, a) => {
      const p = String(a.job.portalName);
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    }, {});

    return res.json({
      totalApplications,
      thisWeek: thisWeekApps,
      avgScore: Math.round((avgScoreAgg._avg.matchScore ?? 0) * 10) / 10,
      portalsConnected: portalsConnected + publicSourcePortals,
      applicationsByDay: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
      applicationsByStatus: byStatus,
      applicationsByPortal: byPortal,
      recentApplications
    });
  } catch (err) {
    return next(err);
  }
});

export default router;

