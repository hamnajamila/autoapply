import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { enqueueMatch } from "../workers/queues";
import { getYouthKeywords, readPreferences } from "../utils/userPreferences";

const router = Router();

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(18),
  keyword: z.string().optional(),
  type: z.string().optional(),
  isRemote: z.coerce.boolean().optional()
});

const KeywordsBody = z.object({
  keywords: z.array(z.string().min(1)).min(1)
});

function inferType(job: { title: string; description: string; tags: string[] }) {
  const haystack = [job.title, job.description, ...(job.tags ?? [])].join(" ").toLowerCase();
  if (haystack.includes("scholarship")) return "scholarship";
  if (haystack.includes("fellowship")) return "fellowship";
  if (haystack.includes("hackathon")) return "hackathon";
  if (haystack.includes("competition")) return "competition";
  return "internship";
}

router.get("/", authenticate, validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { preferences: true }
    });
    const keywords = getYouthKeywords(user?.preferences);
    const allKeywords = q.keyword ? [q.keyword.toLowerCase(), ...keywords] : keywords;

    const jobs = await prisma.job.findMany({
      where: {
        OR: allKeywords.flatMap((keyword) => [
          { title: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
          { tags: { has: keyword } }
        ]),
        ...(q.isRemote !== undefined ? { isRemote: q.isRemote } : {})
      },
      orderBy: { scrapedAt: "desc" },
      take: 150
    });

    const mapped = jobs
      .map((job) => ({
        ...job,
        type: inferType(job)
      }))
      .filter((job) => (q.type ? job.type === q.type : true));

    const start = (q.page - 1) * q.limit;
    const data = mapped.slice(start, start + q.limit);

    return res.json({
      data,
      total: mapped.length,
      page: q.page,
      limit: q.limit,
      keywords
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { preferences: true }
    });
    const keywords = getYouthKeywords(user?.preferences);

    const jobs = await prisma.job.findMany({
      where: {
        OR: keywords.flatMap((keyword) => [
          { title: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
          { tags: { has: keyword } }
        ])
      },
      take: 200
    });

    const counts = jobs.reduce<Record<string, number>>((accumulator, job) => {
      const type = inferType(job);
      accumulator[type] = (accumulator[type] ?? 0) + 1;
      return accumulator;
    }, {});

    return res.json({
      total: jobs.length,
      internships: counts["internship"] ?? 0,
      fellowships: counts["fellowship"] ?? 0,
      hackathons: counts["hackathon"] ?? 0,
      scholarships: counts["scholarship"] ?? 0,
      competitions: counts["competition"] ?? 0,
      keywords
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/keywords", authenticate, validate({ body: KeywordsBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const body = req.body as z.infer<typeof KeywordsBody>;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...prefs,
          youthKeywords: body.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)
        } as any
      }
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/apply/:id", authenticate, async (req, res, next) => {
  try {
    const jobId = String(req.params["id"]);
    await enqueueMatch({ userId: req.auth!.userId, jobId });
    return res.json({ success: true, message: "Youth opportunity queued for matching and apply flow." });
  } catch (error) {
    return next(error);
  }
});

export default router;
