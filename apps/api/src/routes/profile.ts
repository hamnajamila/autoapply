import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { z } from "zod";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { parseResumeText } from "../services/llm/resumeParser";
import type { UserProfile } from "@autoapply/shared";
import { extractRelevantKeywords } from "../services/llm/resumeKeywords";

const router = Router();

async function ensureUploadsDir() {
  const dir = path.isAbsolute(env.UPLOADS_DIR) ? env.UPLOADS_DIR : path.join(process.cwd(), env.UPLOADS_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err as any, "");
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const userId = (req as any).auth?.userId ?? "unknown";
    cb(null, `${userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx)$/i.test(file.originalname || "");
    if (!ok) return cb(null, false);
    return cb(null, true);
  }
});

router.post("/resume", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing file" });

    const buf = await fs.readFile(file.path);
    let text = "";
    if (file.originalname.toLowerCase().endsWith(".pdf")) {
      const parsed = await pdfParse(buf);
      text = parsed.text ?? "";
    } else {
      const parsed = await mammoth.extractRawText({ buffer: buf });
      text = parsed.value ?? "";
    }

    const profile = await parseResumeText(text);
    const extractedKeywords = extractRelevantKeywords(text, [...(profile.skills ?? []), ...(profile.targetJobKeywords ?? [])]);
    const enrichedProfile = {
      ...profile,
      extractedKeywords,
      targetJobKeywords:
        Array.isArray(profile.targetJobKeywords) && profile.targetJobKeywords.length
          ? profile.targetJobKeywords
          : extractedKeywords.slice(0, 20)
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        resumeText: text,
        resumeFileUrl: file.path,
        profileJson: enrichedProfile as any
      }
    });

    return res.json({ profile: enrichedProfile, extractedKeywords });
  } catch (err) {
    return next(err);
  }
});

const UpdateProfileBody = z.object({
  profile: z.any().optional(),
  preferences: z.any().optional(),
  matchThreshold: z.number().int().min(0).max(100).optional(),
  agentSchedule: z.string().min(1).optional(),
  emailNotifications: z.boolean().optional()
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        resumeFileUrl: true,
        resumeText: true,
        profileJson: true,
        preferences: true,
        matchThreshold: true,
        agentSchedule: true,
        agentEnabled: true,
        emailNotifications: true
      }
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json(user);
  } catch (err) {
    return next(err);
  }
});

router.put("/", authenticate, validate({ body: UpdateProfileBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const body = req.body as z.infer<typeof UpdateProfileBody>;
    const profile = body.profile as UserProfile | undefined;
    const data: any = {
      ...(profile ? { profileJson: profile as any } : {}),
      ...(body.preferences !== undefined ? { preferences: body.preferences } : {}),
      ...(body.matchThreshold !== undefined ? { matchThreshold: body.matchThreshold } : {}),
      ...(body.agentSchedule !== undefined ? { agentSchedule: body.agentSchedule } : {}),
      ...(body.emailNotifications !== undefined ? { emailNotifications: body.emailNotifications } : {})
    };
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        profileJson: true,
        preferences: true,
        matchThreshold: true,
        agentSchedule: true,
        agentEnabled: true,
        emailNotifications: true,
        resumeFileUrl: true
      }
    });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

export default router;

