import { Router } from "express";
import { z } from "zod";
import { encrypt } from "@autoapply/shared";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { PortalRegistry } from "../services/portals/PortalRegistry";

const router = Router();

const PORTALS_META = [
  { name: "linkedin", displayName: "LinkedIn", logoUrl: "https://static.licdn.com/sc/h/2if24wp7oqlodqdlgei1n1520", requiresAuth: true, description: "Remote jobs + Easy Apply automation" },
  { name: "jobright", displayName: "JobRight.ai", logoUrl: "https://jobright.ai/favicon.ico", requiresAuth: true, description: "Playwright session-based portal automation" },
  { name: "mercor", displayName: "Mercor", logoUrl: "https://mercor.com/favicon.ico", requiresAuth: true, description: "Multi-step application flow support" },
  { name: "remoteok", displayName: "RemoteOK", logoUrl: "https://remoteok.com/assets/remoteok-48.png", requiresAuth: false, description: "Public API scraping + apply via browser" },
  { name: "remotive", displayName: "Remotive", logoUrl: "https://remotive.com/favicon-32x32.png", requiresAuth: false, description: "Public API scraping + apply via browser" },
  { name: "weworkremotely", displayName: "We Work Remotely", logoUrl: "https://weworkremotely.com/assets/favicon-32.png", requiresAuth: false, description: "HTML scrape + apply via browser" },
  { name: "himalayas", displayName: "Himalayas", logoUrl: "https://himalayas.app/favicon.ico", requiresAuth: false, description: "Public API scraping + apply via browser" },
  { name: "wellfound", displayName: "Wellfound", logoUrl: "https://wellfound.com/favicon.ico", requiresAuth: true, description: "Playwright auth + application flow" },
  { name: "greenhouse", displayName: "Greenhouse ATS", logoUrl: "https://boards.greenhouse.io/favicon.ico", requiresAuth: false, description: "Standardized ATS form automation" },
  { name: "lever", displayName: "Lever ATS", logoUrl: "https://jobs.lever.co/favicon.ico", requiresAuth: false, description: "Standardized ATS form automation" },
  { name: "workday", displayName: "Workday ATS", logoUrl: "https://www.myworkdayjobs.com/favicon.ico", requiresAuth: false, description: "Complex multi-step ATS support" },
  { name: "remoteco", displayName: "Remote.co", logoUrl: "https://remote.co/wp-content/themes/remote-co/favicon.png", requiresAuth: false, description: "HTML scrape + apply via browser" }
] as const;

router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const creds = await prisma.portalCredential.findMany({ where: { userId } });
    const customPortals = await prisma.customPortal.findMany({ where: { userId, isActive: true } });
    const byName = new Map(creds.map((c) => [c.portalName, c]));
    
    // Standard portals
    const standardPortals = PORTALS_META.map((p) => {
      const c = byName.get(p.name);
      return {
        ...p,
        connected: Boolean(c),
        isActive: c?.isActive ?? false,
        lastSynced: c?.lastSynced ?? null,
        lastError: c?.lastError ?? null,
        isCustom: false
      };
    });
    
    // Custom portals
    const customPortalData = customPortals.map((cp) => ({
      name: cp.name,
      displayName: cp.name,
      logoUrl: `https://${new URL(cp.url).hostname}/favicon.ico`,
      requiresAuth: false,
      description: `Custom portal: ${cp.url}`,
      url: cp.url,
      connected: false,
      isActive: cp.isActive,
      lastSynced: null,
      lastError: null,
      isCustom: true,
      id: cp.id
    }));
    
    return res.json({ portals: [...standardPortals, ...customPortalData] });
  } catch (err) {
    return next(err);
  }
});

const ConnectBody = z.object({
  credentials: z.record(z.string(), z.string()).default({})
});

router.post("/:portalName/connect", authenticate, validate({ body: ConnectBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalName = String(req.params["portalName"] || "").toLowerCase();
    const { credentials } = req.body as z.infer<typeof ConnectBody>;

    // ensure portal exists
    const portal = PortalRegistry.get(portalName);

    const encryptedData = encrypt(JSON.stringify(credentials), env.ENCRYPTION_KEY);
    const record = await prisma.portalCredential.upsert({
      where: { userId_portalName: { userId, portalName } },
      update: { encryptedData, isActive: true, lastError: null },
      create: { userId, portalName, encryptedData, isActive: true }
    });

    // test connection best-effort
    let success = true;
    let message = "Connected";
    try {
      await portal.initBrowser(record.cookiesJson ?? undefined);
      if (portal.requiresAuth) {
        const ok = await portal.isLoggedIn().catch(() => false);
        if (!ok) await portal.login(credentials);
      }
      const ok2 = await portal.isLoggedIn().catch(() => false);
      success = ok2;
      message = ok2 ? "Connected and verified" : "Saved credentials, but verification failed";
      const cookiesJson = await portal.saveCookies().catch(() => record.cookiesJson ?? "[]");
      await prisma.portalCredential.update({
        where: { userId_portalName: { userId, portalName } },
        data: { cookiesJson, lastSynced: new Date(), lastError: ok2 ? null : "verification_failed" }
      });
    } catch (e) {
      success = false;
      const rawMessage = e instanceof Error ? e.message : "connection_failed";
      // Check for Playwright browser installation error
      if (rawMessage.includes("Executable doesn't exist") || rawMessage.includes("browserType.launch")) {
        message = "Playwright browsers not installed. Run: npx playwright install chromium";
      } else {
        message = rawMessage;
      }
      await prisma.portalCredential.update({
        where: { userId_portalName: { userId, portalName } },
        data: { lastError: message, lastSynced: new Date() }
      });
    } finally {
      await portal.closeBrowser().catch(() => undefined);
    }

    return res.json({ success, message });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:portalName", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalName = String(req.params["portalName"] || "").toLowerCase();
    
    // Check if it's a custom portal first
    const customPortal = await prisma.customPortal.findUnique({
      where: { userId_name: { userId, name: portalName } }
    });
    
    if (customPortal) {
      await prisma.customPortal.delete({ where: { id: customPortal.id } });
    } else {
      await prisma.portalCredential.delete({ where: { userId_portalName: { userId, portalName } } });
    }
    
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Custom portal endpoints
const CreateCustomPortalBody = z.object({
  name: z.string().min(1),
  url: z.string().url()
});

router.post("/custom", authenticate, validate({ body: CreateCustomPortalBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const { name, url } = req.body as z.infer<typeof CreateCustomPortalBody>;
    
    const customPortal = await prisma.customPortal.create({
      data: { userId, name: name.toLowerCase(), url, isActive: true }
    });
    
    return res.status(201).json({
      success: true,
      portal: {
        name: customPortal.name,
        displayName: customPortal.name,
        logoUrl: `https://${new URL(customPortal.url).hostname}/favicon.ico`,
        requiresAuth: false,
        description: `Custom portal: ${customPortal.url}`,
        url: customPortal.url,
        connected: false,
        isActive: true,
        isCustom: true,
        id: customPortal.id
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return res.status(409).json({ error: "A portal with this name already exists" });
    }
    return next(err);
  }
});

router.delete("/custom/:id", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const id = String(req.params["id"]);
    
    await prisma.customPortal.deleteMany({
      where: { id, userId }
    });
    
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

export default router;

