import { Router } from "express";
import { z } from "zod";
import { decrypt, encrypt } from "@autoapply/shared";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { PortalRegistry } from "../services/portals/PortalRegistry";
import { BrowserManager } from "../services/automation/BrowserManager";
import { readPreferences } from "../utils/userPreferences";

const router = Router();

const PORTALS_META = [
  { name: "linkedin", displayName: "LinkedIn", logoUrl: "https://static.licdn.com/sc/h/2if24wp7oqlodqdlgei1n1520", requiresAuth: true, description: "Remote jobs + Easy Apply automation", connectionMode: "oauth", portalKind: "source" },
  { name: "jobright", displayName: "JobRight.ai", logoUrl: "https://jobright.ai/favicon.ico", requiresAuth: true, description: "Playwright session-based portal automation", connectionMode: "credentials", portalKind: "source" },
  { name: "mercor", displayName: "Mercor", logoUrl: "https://mercor.com/favicon.ico", requiresAuth: true, description: "Multi-step application flow support", connectionMode: "credentials", portalKind: "source" },
  { name: "remoteok", displayName: "RemoteOK", logoUrl: "https://remoteok.com/assets/remoteok-48.png", requiresAuth: false, description: "Public API scraping + apply via browser", connectionMode: "none", portalKind: "source" },
  { name: "remotive", displayName: "Remotive", logoUrl: "https://remotive.com/favicon-32x32.png", requiresAuth: false, description: "Public API scraping + apply via browser", connectionMode: "none", portalKind: "source" },
  { name: "weworkremotely", displayName: "We Work Remotely", logoUrl: "https://weworkremotely.com/assets/favicon-32.png", requiresAuth: false, description: "HTML scrape + apply via browser", connectionMode: "none", portalKind: "source" },
  { name: "himalayas", displayName: "Himalayas", logoUrl: "https://himalayas.app/favicon.ico", requiresAuth: false, description: "Public API scraping + apply via browser", connectionMode: "none", portalKind: "source" },
  { name: "wellfound", displayName: "Wellfound", logoUrl: "https://wellfound.com/favicon.ico", requiresAuth: true, description: "Playwright auth + application flow", connectionMode: "credentials", portalKind: "source" },
  { name: "greenhouse", displayName: "Greenhouse ATS", logoUrl: "https://boards.greenhouse.io/favicon.ico", requiresAuth: false, description: "Standardized ATS form automation", connectionMode: "none", portalKind: "ats" },
  { name: "lever", displayName: "Lever ATS", logoUrl: "https://jobs.lever.co/favicon.ico", requiresAuth: false, description: "Standardized ATS form automation", connectionMode: "none", portalKind: "ats" },
  { name: "workday", displayName: "Workday ATS", logoUrl: "https://www.myworkdayjobs.com/favicon.ico", requiresAuth: false, description: "Complex multi-step ATS support", connectionMode: "none", portalKind: "ats" },
  { name: "remoteco", displayName: "Remote.co", logoUrl: "https://remote.co/wp-content/themes/remote-co/favicon.png", requiresAuth: false, description: "HTML scrape + apply via browser", connectionMode: "none", portalKind: "source" }
] as const;

function normalizePortalError(rawError: string | null | undefined) {
  if (!rawError) {
    return null;
  }

  const ansiEscapeRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
  const cleaned = rawError
    .replace(ansiEscapeRegex, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();

  if (lower.includes("browsertype.launch") || lower.includes("playwright install chromium") || lower.includes("executable doesn't exist")) {
    return {
      code: "browser_setup_required",
      message: "Browser automation needs Playwright Chromium installed in the current runtime.",
      helpText: "Install the browser runtime once, then reconnect this portal."
    };
  }

  if (lower.includes("verification_failed")) {
    return {
      code: "verification_failed",
      message: "Credentials were saved, but the portal could not be verified.",
      helpText: "Reconnect this portal and confirm the account details are still valid."
    };
  }

  if (lower.includes("captcha_required")) {
    return {
      code: "captcha_required",
      message: "A CAPTCHA blocked automation for this portal.",
      helpText: "Manual intervention is required before automation can continue."
    };
  }

  if (lower.includes("portal_login_form_unavailable") || (lower.includes("locator.fill") && lower.includes("timeout"))) {
    return {
      code: "login_flow_changed",
      message: "The portal sign-in form did not load as expected.",
      helpText: "Reconnect this portal after the site finishes loading. If the portal uses Google, Apple, or another SSO-only flow, direct password login may not work yet."
    };
  }

  if (lower.includes("missing_credentials")) {
    return {
      code: "missing_credentials",
      message: "This portal needs both an email and password to verify the connection.",
      helpText: "Enter the credentials for your account on this portal, not a different service."
    };
  }

  if (lower.includes("browser_setup_required")) {
    return {
      code: "browser_setup_required",
      message: "Browser automation needs Playwright Chromium installed in the current runtime.",
      helpText: "Install the browser runtime once, then retry the portal check."
    };
  }

  return {
    code: "connection_issue",
    message: cleaned.slice(0, 220),
    helpText: "Reconnect this portal or review the runtime setup."
  };
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const [creds, customPortals, user] = await Promise.all([
      prisma.portalCredential.findMany({ where: { userId } }),
      prisma.customPortal.findMany({ where: { userId, isActive: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } })
    ]);
    const byName = new Map(creds.map((c) => [c.portalName, c]));
    const needsBrowserRuntimeCheck = creds.some((cred) => cred.lastError === "browser_setup_required");
    const browserRuntimeReady = needsBrowserRuntimeCheck ? await BrowserManager.isBrowserRuntimeReady() : false;
    const customPortalMeta = readPreferences(readPreferences(user?.preferences)["customPortalMeta"]);
    
    // Standard portals
    const standardPortals = PORTALS_META.map((p) => {
      const c = byName.get(p.name);
      const normalizedError =
        p.requiresAuth && c?.lastError === "browser_setup_required" && browserRuntimeReady
          ? {
              code: "reconnect_required",
              message: "Browser automation is ready again. Reconnect this portal to verify the saved credentials.",
              helpText: "The earlier runtime issue has been resolved. Reconnect once to refresh this portal session."
            }
          : p.requiresAuth
            ? normalizePortalError(c?.lastError)
            : null;
      const status = p.portalKind === "ats" ? "built_in" : p.requiresAuth ? (!c ? "not_connected" : normalizedError ? "needs_attention" : "connected") : "available";
      return {
        ...p,
        connected: p.requiresAuth ? Boolean(c) : false,
        ready: p.portalKind === "ats" ? true : p.requiresAuth ? Boolean(c && !normalizedError) : true,
        status,
        isActive: c?.isActive ?? false,
        lastSynced: p.requiresAuth ? c?.lastSynced ?? null : null,
        lastError: normalizedError?.message ?? null,
        lastErrorCode: normalizedError?.code ?? null,
        helpText:
          normalizedError?.helpText ??
          (p.portalKind === "ats"
            ? "Handled automatically when an application redirects to this ATS."
            : p.requiresAuth
              ? null
              : "No sign-in required. This source is available to the agent by default."),
        isCustom: false
      };
    });
    
    // Custom portals
    const customPortalData = customPortals.map((cp) => {
      const meta = readPreferences(customPortalMeta[cp.id]);
      return ({
      name: cp.name,
      displayName: meta["displayName"] ?? cp.name,
      logoUrl: meta["logoUrl"] ?? `https://${new URL(cp.url).hostname}/favicon.ico`,
      requiresAuth: false,
      description: `Custom portal: ${cp.url}`,
      url: cp.url,
      connected: false,
      ready: false,
      status: "custom",
      isActive: cp.isActive,
      lastSynced: null,
      lastError: null,
      lastErrorCode: null,
      helpText: "Custom portals are tracked here and can be integrated gradually.",
      isCustom: true,
      id: cp.id
    });
    });
    
    
    return res.json({ portals: [...standardPortals, ...customPortalData] });
  } catch (err) {
    return next(err);
  }
});

const ConnectBody = z.object({
  credentials: z.record(z.string(), z.string()).default({}),
  manualCookies: z.string().optional(),
  useAutoApplyCredentials: z.boolean().optional()
});

async function getAutoApplyCredentialSeed(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true, email: true }
  });
  const prefs = readPreferences(user?.preferences);
  const seed = readPreferences(prefs["autoApplyCredentialSeed"]);
  return {
    email: typeof seed["email"] === "string" ? seed["email"] : user?.email ?? "",
    encryptedPassword: typeof seed["encryptedPassword"] === "string" ? seed["encryptedPassword"] : ""
  };
}

async function persistAutoApplyCredentialSeed(userId: string, email: string, password: string) {
  if (!email || !password) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true }
  });
  const prefs = readPreferences(user?.preferences);
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        autoApplyCredentialSeed: {
          email,
          encryptedPassword: encrypt(password, env.ENCRYPTION_KEY),
          updatedAt: new Date().toISOString()
        }
      } as any
    }
  });
}

const COOKIE_CAPTURE_TARGETS: Record<string, string> = {
  mercor: "https://mercor.com",
  jobright: "https://jobright.ai",
  wellfound: "https://wellfound.com",
  linkedin: "https://www.linkedin.com"
};

async function captureCookiesFromActiveBrowser(portalName: string): Promise<string> {
  const targetUrl = COOKIE_CAPTURE_TARGETS[portalName];
  if (!targetUrl) {
    throw new Error("cookie_capture_unsupported_portal");
  }

  // chrome-cookies-secure requires direct access to the local desktop browser profile.
  // In containerized Linux runtimes this is unavailable and can crash native sqlite bindings.
  if (process.platform !== "win32") {
    throw new Error("cookie_capture_local_desktop_only");
  }

  const chromeCookiesSecure = await import("chrome-cookies-secure");
  const getCookies = chromeCookiesSecure.default?.getCookies ?? chromeCookiesSecure.getCookies;
  if (!getCookies) {
    throw new Error("cookie_capture_unavailable");
  }

  const cookieHeader = await new Promise<string>((resolve, reject) => {
    getCookies(
      targetUrl,
      "header",
      (error: unknown, values: string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(values ?? "");
      }
    );
  });

  const normalized = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      const name = separatorIndex > -1 ? part.slice(0, separatorIndex).trim() : part.trim();
      const value = separatorIndex > -1 ? part.slice(separatorIndex + 1).trim() : "";
      return {
        name,
        value,
        domain: new URL(targetUrl).hostname
      };
    })
    .filter((cookie) => cookie.name.length > 0);
  if (!normalized.length) {
    throw new Error("cookie_capture_empty");
  }
  return JSON.stringify(normalized);
}

router.post("/:portalName/connect", authenticate, validate({ body: ConnectBody }), async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const portalName = String(req.params["portalName"] || "").toLowerCase();
    const { credentials, manualCookies, useAutoApplyCredentials } = req.body as z.infer<typeof ConnectBody>;
    const portalMeta = PORTALS_META.find((portal) => portal.name === portalName);
    if (!portalMeta) {
      return res.status(404).json({ error: "Unknown portal" });
    }

    if (!portalMeta.requiresAuth) {
      return res.status(400).json({ error: "This portal does not require saved credentials." });
    }

    // ensure portal exists
    const portal = PortalRegistry.get(portalName);

    const finalCredentials = { ...credentials };
    if (useAutoApplyCredentials) {
      const seed = await getAutoApplyCredentialSeed(userId);
      const seededEmail = seed.email;
      const encryptedPassword = seed.encryptedPassword || null;
      if (seededEmail) {
        finalCredentials["email"] = seededEmail;
      }
      if (encryptedPassword) {
        finalCredentials["password"] = decrypt(encryptedPassword, env.ENCRYPTION_KEY);
      }
    }
    if (!useAutoApplyCredentials && finalCredentials["email"] && finalCredentials["password"]) {
      await persistAutoApplyCredentialSeed(userId, finalCredentials["email"], finalCredentials["password"]);
    }
    if (!finalCredentials["email"] || !finalCredentials["password"]) {
      return res.status(400).json({
        error:
          "Missing credentials. Enter portal email/password once, then you can reuse AutoApply credentials in one click."
      });
    }

    const encryptedData = encrypt(JSON.stringify(finalCredentials), env.ENCRYPTION_KEY);
    const record = await prisma.portalCredential.upsert({
      where: { userId_portalName: { userId, portalName } },
      update: { encryptedData, isActive: true, lastError: null },
      create: { userId, portalName, encryptedData, isActive: true }
    });

    // test connection best-effort
    let success = true;
    let message = "Connected";
    try {
      const usedManualCookies = Boolean(manualCookies);
      if (manualCookies) {
        // Test parsing before using
        try { JSON.parse(manualCookies); } catch { throw new Error("Invalid cookie JSON format"); }
      }
      
      await portal.initBrowser(manualCookies || record.cookiesJson || undefined);
      if (portal.requiresAuth) {
        const ok = await portal.isLoggedIn().catch(() => false);
        if (!ok && !manualCookies) await portal.login(finalCredentials);
      }
      const ok2 = await portal.isLoggedIn().catch(() => false);
      success = ok2 || usedManualCookies;
      message = ok2
        ? "Connected and verified"
        : usedManualCookies
          ? "Cookies saved. Verification may require a fresh browser session."
          : "Saved credentials, but verification failed";
      
      const cookiesJson = manualCookies || (await portal.saveCookies().catch(() => record.cookiesJson ?? "[]"));
      await prisma.portalCredential.update({
        where: { userId_portalName: { userId, portalName } },
        data: {
          cookiesJson,
          lastSynced: new Date(),
          lastError: ok2 ? null : usedManualCookies ? null : "verification_failed"
        }
      });
    } catch (e) {
      success = false;
      const rawMessage = e instanceof Error ? e.message : "connection_failed";
      const normalizedError = normalizePortalError(rawMessage);
      message = normalizedError?.message ?? "Connection failed";
      await prisma.portalCredential.update({
        where: { userId_portalName: { userId, portalName } },
        data: { lastError: normalizedError?.code ?? rawMessage, lastSynced: new Date() }
      });
    } finally {
      await portal.closeBrowser().catch(() => undefined);
    }

    return res.json({ success, message });
  } catch (err) {
    return next(err);
  }
});

router.post("/:portalName/capture-cookies", authenticate, async (req, res) => {
  const userId = req.auth!.userId;
  const portalName = String(req.params["portalName"] || "").toLowerCase();

  try {
    const cookiesJson = await captureCookiesFromActiveBrowser(portalName);
    await prisma.portalCredential.upsert({
      where: { userId_portalName: { userId, portalName } },
      update: { cookiesJson, isActive: true, lastError: null, lastSynced: new Date() },
      create: {
        userId,
        portalName,
        encryptedData: encrypt(JSON.stringify({}), env.ENCRYPTION_KEY),
        cookiesJson,
        isActive: true,
        lastSynced: new Date()
      }
    });
    return res.json({
      success: true,
      message: "Cookies captured from active browser profile and saved."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cookie_capture_failed";
    if (message.includes("cookie_capture_local_desktop_only")) {
      return res.status(400).json({
        error:
          "One-click browser profile capture requires running AutoApply API directly on your local Windows machine (not inside Docker). Use manual cookie paste for now."
      });
    }
    if (message.includes("cookie_capture_empty")) {
      return res.status(400).json({
        error: "No cookies found. Log in to this portal in Chrome first, then retry capture."
      });
    }
    return res.status(400).json({
      error:
        "Could not capture cookies from active browser profile. Make sure Chrome is installed, you are logged in to the portal, and this app runs on your local machine."
    });
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

