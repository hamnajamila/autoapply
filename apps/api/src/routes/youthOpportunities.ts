import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { enqueueMatch } from "../workers/queues";
import { getYouthKeywords, readPreferences } from "../utils/userPreferences";
import { filterRelevantListings, getProfileFocusTerms } from "../services/llm/resumeKeywords";
import type { UserProfile } from "@autoapply/shared";
import { sanitizeText } from "../utils/text";
import { inferYouthOpportunityType, isLikelyYouthListing } from "../utils/jobClassification";

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

router.get("/", authenticate, validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { preferences: true, profileJson: true }
    });
    const keywords = getYouthKeywords(user?.preferences);
    const profile = (user?.profileJson ?? {}) as UserProfile;
    const profileFocus = getProfileFocusTerms(profile, 16);
    const allKeywords = q.keyword ? [q.keyword.toLowerCase(), ...keywords, ...profileFocus] : [...keywords, ...profileFocus];
    const uniqueKeywords = Array.from(new Set(allKeywords.filter(Boolean)));

    const jobs = await prisma.job.findMany({
      where: uniqueKeywords.length
        ? {
            OR: uniqueKeywords.flatMap((keyword) => [
              { title: { contains: keyword, mode: "insensitive" } },
              { description: { contains: keyword, mode: "insensitive" } },
              { tags: { has: keyword } }
            ]),
            ...(q.isRemote !== undefined ? { isRemote: q.isRemote } : {})
          }
        : {
            ...(q.isRemote !== undefined ? { isRemote: q.isRemote } : {}),
            isRemote: q.isRemote ?? true
          },
      orderBy: { scrapedAt: "desc" },
      take: 250
    });

    const mapped = jobs
      .map((job) => ({
        ...job,
        title: sanitizeText(job.title),
        company: sanitizeText(job.company),
        description: sanitizeText(job.description),
        type: inferYouthOpportunityType(job)
      }))
      .filter((job) => (q.type ? job.type === q.type : true))
      .filter((job) => isLikelyYouthListing(job));

    const relevantRanked = profileFocus.length
      ? filterRelevantListings(mapped as any, profile, 12).sort((left, right) => {
          if (right.relevanceScore !== left.relevanceScore) return right.relevanceScore - left.relevanceScore;
          return new Date((right as any).scrapedAt).getTime() - new Date((left as any).scrapedAt).getTime();
        })
      : mapped
          .sort((left, right) => new Date(right.scrapedAt).getTime() - new Date(left.scrapedAt).getTime())
          .map((item) => ({ ...item, relevanceScore: 0 }));

    const start = (q.page - 1) * q.limit;
    const data = relevantRanked.slice(start, start + q.limit);

    return res.json({
      data,
      total: relevantRanked.length,
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
      select: { preferences: true, profileJson: true }
    });
    const keywords = getYouthKeywords(user?.preferences);
    const profile = (user?.profileJson ?? {}) as UserProfile;
    const profileFocus = getProfileFocusTerms(profile, 16);
    const combinedKeywords = [...keywords, ...profileFocus];
    const uniqueKeywords = Array.from(new Set(combinedKeywords.filter(Boolean)));
    const statsWhere = uniqueKeywords.length
      ? {
          OR: uniqueKeywords.flatMap((keyword) => [
            { title: { contains: keyword, mode: "insensitive" as const } },
            { description: { contains: keyword, mode: "insensitive" as const } },
            { tags: { has: keyword } }
          ])
        }
      : {};

    const jobs = await prisma.job.findMany({
      where: statsWhere,
      take: 250
    });

    const baseJobs = jobs
      .map((job) => ({ ...job, type: inferYouthOpportunityType(job) }))
      .filter((job) => isLikelyYouthListing(job));
    const ranked =
      profileFocus.length > 0
        ? filterRelevantListings(baseJobs as any, profile, 12)
        : baseJobs.map((item) => ({ ...item, relevanceScore: 0 }));

    const counts = ranked.reduce<Record<string, number>>((accumulator, job) => {
      const type = (job as any).type;
      accumulator[type] = (accumulator[type] ?? 0) + 1;
      return accumulator;
    }, {});

    return res.json({
      total: ranked.length,
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
