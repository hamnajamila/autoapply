import crypto from "node:crypto";
import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { z } from "zod";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { readPreferences } from "../utils/userPreferences";

const router = Router();

const CustomPortalBody = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  baseUrl: z.string().url(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  authMethod: z.string().optional(),
  authConfig: z.any().optional(),
  scrapeMethod: z.enum(["selector", "api"]).default("selector"),
  scrapeConfig: z.any().optional(),
  realtimeEnabled: z.boolean().optional()
});

const TestBody = z.object({
  baseUrl: z.string().url(),
  scrapeMethod: z.enum(["selector", "api"]).default("selector"),
  scrapeConfig: z.any().optional()
});

function getCustomPortalMeta(preferences: unknown) {
  const prefs = readPreferences(preferences);
  return readPreferences(prefs["customPortalMeta"]);
}

function readPath(source: unknown, path: string) {
  const segments = path.replace(/^\$\./, "").replace(/^\$/, "").split(".").filter(Boolean);
  let current: any = source;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

async function selectorSample(baseUrl: string, config: Record<string, any>) {
  const html = String((await axios.get(baseUrl, { timeout: 30000 })).data ?? "");
  const $ = cheerio.load(html);
  const listingSelector = String(config["listingSelector"] ?? "a[href]");
  const titleSelector = String(config["titleSelector"] ?? "");
  const companySelector = String(config["companySelector"] ?? "");
  const locationSelector = String(config["locationSelector"] ?? "");
  const applyLinkSelector = String(config["applyLinkSelector"] ?? "a[href]");
  const idSelector = String(config["idSelector"] ?? "");

  return $(listingSelector)
    .slice(0, 5)
    .map((_index, element) => {
      const root = $(element);
      const title = titleSelector ? root.find(titleSelector).first().text().trim() : root.text().trim();
      const company = companySelector ? root.find(companySelector).first().text().trim() : new URL(baseUrl).hostname;
      const location = locationSelector ? root.find(locationSelector).first().text().trim() : "Remote";
      const applyHref = applyLinkSelector ? root.find(applyLinkSelector).first().attr("href") : root.attr("href");
      const applyUrl = applyHref ? new URL(applyHref, baseUrl).toString() : baseUrl;
      const externalId = idSelector ? root.find(idSelector).first().text().trim() : applyUrl;
      return {
        externalId: externalId || applyUrl,
        title: title || "Untitled role",
        company: company || new URL(baseUrl).hostname,
        location,
        applyUrl,
        hasDescription: false
      };
    })
    .get();
}

async function apiSample(baseUrl: string, config: Record<string, any>) {
  const endpoint = String(config["endpoint"] ?? baseUrl);
  const method = String(config["method"] ?? "GET").toUpperCase();
  const headers = readPreferences(config["headers"]);
  const paths = readPreferences(config["paths"]);
  const response = await axios.request({
    url: endpoint,
    method: method as "GET" | "POST",
    headers,
    data: config["body"],
    timeout: 30000
  });
  const rootPath = String(paths["root"] ?? "$");
  const titlePath = String(paths["title"] ?? "title");
  const companyPath = String(paths["company"] ?? "company");
  const locationPath = String(paths["location"] ?? "location");
  const applyUrlPath = String(paths["applyUrl"] ?? "applyUrl");
  const idPath = String(paths["id"] ?? "id");

  const root = readPath(response.data, rootPath);
  const items = Array.isArray(root) ? root : Array.isArray(response.data) ? response.data : [];

  return items.slice(0, 5).map((item) => ({
    externalId: String(readPath(item, idPath) ?? crypto.randomUUID()),
      title: String(readPath(item, titlePath) ?? "Untitled role"),
      company: String(readPath(item, companyPath) ?? new URL(baseUrl).hostname),
      location: String(readPath(item, locationPath) ?? "Remote"),
      applyUrl: String(readPath(item, applyUrlPath) ?? baseUrl),
      hasDescription: Boolean(readPath(item, String(paths["description"] ?? "description")))
  }));
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { preferences: true, customPortals: { orderBy: { createdAt: "desc" } } }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const metaById = getCustomPortalMeta(user.preferences);
    const data = user.customPortals.map((portal) => {
      const meta = readPreferences(metaById[portal.id]);
      return {
        id: portal.id,
        name: portal.name,
        displayName: meta["displayName"] ?? portal.name,
        baseUrl: portal.url,
        logoUrl: meta["logoUrl"] ?? null,
        authMethod: meta["authMethod"] ?? "none",
        authConfig: meta["authConfig"] ?? null,
        scrapeMethod: meta["scrapeMethod"] ?? "selector",
        scrapeConfig: meta["scrapeConfig"] ?? {},
        realtimeEnabled: meta["realtimeEnabled"] ?? true,
        isActive: portal.isActive,
        createdAt: portal.createdAt,
        updatedAt: portal.updatedAt
      };
    });

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
});

router.post("/test", authenticate, validate({ body: TestBody }), async (req, res) => {
  const body = req.body as z.infer<typeof TestBody>;

  try {
    const sample =
      body.scrapeMethod === "api"
        ? await apiSample(body.baseUrl, readPreferences(body.scrapeConfig))
        : await selectorSample(body.baseUrl, readPreferences(body.scrapeConfig));

    return res.json({ success: true, sample });
  } catch (error) {
    return res.json({
      success: false,
      sample: [],
      error: error instanceof Error ? error.message : "Test scrape failed"
    });
  }
});

router.post("/", authenticate, validate({ body: CustomPortalBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const body = req.body as z.infer<typeof CustomPortalBody>;

    const portal = await prisma.customPortal.create({
      data: {
        userId,
        name: body.name.trim().toLowerCase().replace(/\s+/g, "-"),
        url: body.baseUrl,
        isActive: true
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const meta = getCustomPortalMeta(user?.preferences);
    meta[portal.id] = {
      displayName: body.displayName,
      logoUrl: body.logoUrl || null,
      authMethod: body.authMethod ?? "none",
      authConfig: body.authConfig ?? null,
      scrapeMethod: body.scrapeMethod,
      scrapeConfig: body.scrapeConfig ?? {},
      realtimeEnabled: body.realtimeEnabled ?? true
    };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, customPortalMeta: meta } as any }
    });

    return res.status(201).json({ success: true, id: portal.id });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, validate({ body: CustomPortalBody.partial() }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalId = String(req.params["id"]);
    const body = req.body as Partial<z.infer<typeof CustomPortalBody>>;

    await prisma.customPortal.updateMany({
      where: { id: portalId, userId },
      data: {
        ...(body.name ? { name: body.name.trim().toLowerCase().replace(/\s+/g, "-") } : {}),
        ...(body.baseUrl ? { url: body.baseUrl } : {})
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const meta = getCustomPortalMeta(user?.preferences);
    meta[portalId] = {
      ...readPreferences(meta[portalId]),
      ...(body.displayName ? { displayName: body.displayName } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl || null } : {}),
      ...(body.authMethod ? { authMethod: body.authMethod } : {}),
      ...(body.authConfig !== undefined ? { authConfig: body.authConfig } : {}),
      ...(body.scrapeMethod ? { scrapeMethod: body.scrapeMethod } : {}),
      ...(body.scrapeConfig !== undefined ? { scrapeConfig: body.scrapeConfig } : {}),
      ...(body.realtimeEnabled !== undefined ? { realtimeEnabled: body.realtimeEnabled } : {})
    };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, customPortalMeta: meta } as any }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/toggle", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalId = String(req.params["id"]);
    const portal = await prisma.customPortal.findFirst({ where: { id: portalId, userId } });
    if (!portal) return res.status(404).json({ error: "Portal not found" });

    await prisma.customPortal.update({
      where: { id: portal.id },
      data: { isActive: !portal.isActive }
    });

    return res.json({ success: true, isActive: !portal.isActive });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalId = String(req.params["id"]);

    await prisma.customPortal.deleteMany({ where: { id: portalId, userId } });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = readPreferences(user?.preferences);
    const meta = getCustomPortalMeta(user?.preferences);
    delete meta[portalId];

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...prefs, customPortalMeta: meta } as any }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
