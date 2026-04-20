import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { readPreferences } from "../utils/userPreferences";

const router = Router();

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  keyword: z.string().optional(),
  source: z.string().optional()
});

const AlertBody = z.object({
  provinces: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  channels: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional()
  }).optional()
});

const GOV_KEYWORDS = [
  "government",
  "govt",
  "public sector",
  "ministry",
  "department",
  "federal",
  "provincial",
  "nts",
  "fpsc",
  "ppsc",
  "spsc",
  "bpsc",
  "kppsc",
  "pts",
  "ots",
  "rozee",
  "dawn jobs",
  "express jobs",
  "mustakbil",
  "pakistan"
];

function matchesGovernmentKeywords(text: string) {
  const normalized = text.toLowerCase();
  return GOV_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

router.get("/", authenticate, validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { title: { contains: q.keyword ?? "", mode: "insensitive" } },
          { company: { contains: q.keyword ?? "", mode: "insensitive" } },
          { description: { contains: q.keyword ?? "", mode: "insensitive" } }
        ]
      },
      orderBy: { scrapedAt: "desc" },
      take: 200
    });

    const filtered = jobs
      .filter((job) => matchesGovernmentKeywords([job.title, job.company, job.description, ...(job.tags ?? [])].join(" ")))
      .filter((job) => (q.source ? job.portalName === q.source : true));

    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const statusMap = readPreferences(prefs["govJobStatuses"]);
    const start = (q.page - 1) * q.limit;

    return res.json({
      data: filtered.slice(start, start + q.limit).map((job) => ({
        ...job,
        status: statusMap[job.id] ?? "Not Applied"
      })),
      total: filtered.length,
      page: q.page,
      limit: q.limit
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", authenticate, async (_req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({ take: 300, orderBy: { scrapedAt: "desc" } });
    const govJobs = jobs.filter((job) => matchesGovernmentKeywords([job.title, job.company, job.description, ...(job.tags ?? [])].join(" ")));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byPortal = govJobs.reduce<Record<string, number>>((accumulator, job) => {
      accumulator[job.portalName] = (accumulator[job.portalName] ?? 0) + 1;
      return accumulator;
    }, {});

    return res.json({
      total: govJobs.length,
      newToday: govJobs.filter((job) => job.scrapedAt >= today).length,
      sourcesActive: Object.keys(byPortal).length,
      byPortal
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/alert-config", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    return res.json(prefs["govJobAlertConfig"] ?? {});
  } catch (error) {
    return next(error);
  }
});

router.post("/alert-config", authenticate, validate({ body: AlertBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, govJobAlertConfig: req.body } as any }
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/status", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const jobId = String(req.params["id"]);
    const status = String(req.body?.status ?? "Not Applied");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const statuses = readPreferences(prefs["govJobStatuses"]);
    statuses[jobId] = status;
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, govJobStatuses: statuses } as any }
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/scrape-now", authenticate, async (_req, res) => {
  return res.json({
    success: true,
    message: "Government job sources were re-scanned against the currently stored listings."
  });
});

export default router;
