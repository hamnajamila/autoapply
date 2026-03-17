import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";

const router = Router();

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  portal: z.string().optional(),
  status: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(["date", "score", "company"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  format: z.enum(["json", "csv"]).default("json")
});

function toCSV(rows: any[]) {
  const headers = ["company", "title", "portal", "score", "status", "appliedAt", "createdAt", "jobUrl"];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => {
          const val =
            h === "company"
              ? r.job.company
              : h === "title"
                ? r.job.title
                : h === "portal"
                  ? r.job.portalName
                  : h === "score"
                    ? r.matchScore
                    : h === "jobUrl"
                      ? r.job.applyUrl
                      : (r as any)[h];
          return escape(val);
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

router.get("/", authenticate, validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const skip = (q.page - 1) * q.limit;

    const portalFilter = q.portal ? q.portal.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const statusFilter = q.status ? q.status.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const where: any = {
      userId,
      ...(q.minScore != null || q.maxScore != null
        ? { matchScore: { ...(q.minScore != null ? { gte: q.minScore } : {}), ...(q.maxScore != null ? { lte: q.maxScore } : {}) } }
        : {}),
      ...(statusFilter.length ? { status: { in: statusFilter } } : {}),
      ...(q.startDate || q.endDate
        ? {
            createdAt: {
              ...(q.startDate ? { gte: new Date(q.startDate) } : {}),
              ...(q.endDate ? { lte: new Date(q.endDate) } : {})
            }
          }
        : {}),
      ...(portalFilter.length ? { job: { portalName: { in: portalFilter } } } : {})
    };

    const orderBy =
      q.sortBy === "score"
        ? { matchScore: q.sortOrder }
        : q.sortBy === "company"
          ? { job: { company: q.sortOrder } }
          : { createdAt: q.sortOrder };

    const [total, data] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include: { job: true },
        orderBy,
        skip,
        take: q.limit
      })
    ]);

    if (q.format === "csv") {
      const csv = toCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=applications.csv");
      return res.status(200).send(csv);
    }

    return res.json({ data, total, page: q.page, limit: q.limit });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const id = String(req.params["id"]);
    const app = await prisma.application.findFirst({
      where: { id, userId },
      include: { job: true }
    });
    if (!app) return res.status(404).json({ error: "Not found" });
    return res.json(app);
  } catch (err) {
    return next(err);
  }
});

export default router;

