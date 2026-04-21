import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { readPreferences, removeArrayItem, upsertArrayItem } from "../utils/userPreferences";
import { extractRelevantKeywords } from "../services/llm/resumeKeywords";

const router = Router();

const EntryBody = z.object({
  questionRaw: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().min(1).default("custom")
});

const LookupBody = z.object({
  questionText: z.string().min(1)
});

function normalizeQuestion(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreQuestionSimilarity(left: string, right: string) {
  if (left === right) return 1;
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const overlap = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size);
}

function getAnswerLibrary(preferences: unknown) {
  const prefs = readPreferences(preferences);
  return Array.isArray(prefs["answerLibrary"]) ? prefs["answerLibrary"] : [];
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const category = typeof req.query["category"] === "string" ? req.query["category"] : undefined;
    const page = Number(req.query["page"] ?? 1);
    const limit = Number(req.query["limit"] ?? 50);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { preferences: true } });
    const entries = getAnswerLibrary(user?.preferences).filter((entry: any) => (category ? entry.category === category : true));
    const start = (page - 1) * limit;
    return res.json({
      data: entries.slice(start, start + limit),
      total: entries.length,
      page,
      limit
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, validate({ body: EntryBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const body = req.body as z.infer<typeof EntryBody>;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const entries = getAnswerLibrary(user?.preferences);
    const now = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID(),
      questionRaw: body.questionRaw,
      questionNormalized: normalizeQuestion(body.questionRaw),
      answer: body.answer,
      category: body.category,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null
    };
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, answerLibrary: upsertArrayItem(entries, entry) } as any }
    });
    return res.status(201).json(entry);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, validate({ body: EntryBody.partial() }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const entryId = String(req.params["id"]);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const entries = getAnswerLibrary(user?.preferences);
    const current = entries.find((entry: any) => entry.id === entryId);
    if (!current) return res.status(404).json({ error: "Entry not found" });
    const nextEntry = {
      ...current,
      ...(req.body?.questionRaw ? { questionRaw: req.body.questionRaw, questionNormalized: normalizeQuestion(req.body.questionRaw) } : {}),
      ...(req.body?.answer ? { answer: req.body.answer } : {}),
      ...(req.body?.category ? { category: req.body.category } : {}),
      updatedAt: new Date().toISOString()
    };
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, answerLibrary: upsertArrayItem(entries, nextEntry) } as any }
    });
    return res.json(nextEntry);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const entryId = String(req.params["id"]);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const entries = getAnswerLibrary(user?.preferences);
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, answerLibrary: removeArrayItem(entries, entryId) } as any }
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/lookup", authenticate, validate({ body: LookupBody }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof LookupBody>;
    const normalized = normalizeQuestion(body.questionText);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { preferences: true } });
    const entries = getAnswerLibrary(user?.preferences);
    const ranked = entries
      .map((entry: any) => ({
        entry,
        score: scoreQuestionSimilarity(normalized, normalizeQuestion(entry.questionRaw ?? entry.questionNormalized ?? ""))
      }))
      .sort((left: any, right: any) => right.score - left.score);

    const best = ranked[0];
    if (!best || best.score < 0.5) {
      return res.json({ found: false });
    }

    return res.json({
      found: true,
      answer: best.entry.answer,
      confidence: Number(best.score.toFixed(2))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/populate", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, profileJson: true, preferences: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const profile = (user.profileJson ?? {}) as any;
    const generated = [
      user.name ? { questionRaw: "What is your full name?", answer: user.name, category: "personal_info" } : null,
      user.email ? { questionRaw: "What is your email address?", answer: user.email, category: "personal_info" } : null,
      profile.phone ? { questionRaw: "What is your phone number?", answer: profile.phone, category: "personal_info" } : null,
      profile.location ? { questionRaw: "Where are you located?", answer: profile.location, category: "personal_info" } : null,
      profile.summary ? { questionRaw: "Please provide a professional summary.", answer: profile.summary, category: "work_experience" } : null,
      Array.isArray(profile.skills) && profile.skills.length
        ? { questionRaw: "What are your key skills?", answer: profile.skills.join(", "), category: "skills" }
        : null,
      Array.isArray(profile.targetJobKeywords) && profile.targetJobKeywords.length
        ? { questionRaw: "Which keywords best describe the roles you want?", answer: profile.targetJobKeywords.join(", "), category: "skills" }
        : null
    ].filter(Boolean) as Array<{ questionRaw: string; answer: string; category: string }>;

    const userPrefs = readPreferences(user.preferences);
    const current = getAnswerLibrary(user.preferences);
    const now = new Date().toISOString();
    const nextEntries = generated.map((entry) => ({
      id: crypto.randomUUID(),
      questionRaw: entry.questionRaw,
      questionNormalized: normalizeQuestion(entry.questionRaw),
      answer: entry.answer,
      category: entry.category,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null
    }));

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...userPrefs, answerLibrary: [...nextEntries, ...current] } as any }
    });

    return res.json({ success: true, created: nextEntries.length, keywords: extractRelevantKeywords(JSON.stringify(profile)) });
  } catch (error) {
    return next(error);
  }
});

export default router;
