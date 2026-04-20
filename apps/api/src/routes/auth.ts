import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { z } from "zod";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { encrypt } from "@autoapply/shared";
import { validate } from "../middleware/validate";
import { EmailService } from "../services/email/EmailService";

const router = Router();

const RegisterBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const ForgotPasswordBody = z.object({
  email: z.string().email()
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

function getLinkedInConfigStatus() {
  const missing = [
    !env.LINKEDIN_CLIENT_ID ? "LINKEDIN_CLIENT_ID" : null,
    !env.LINKEDIN_CLIENT_SECRET ? "LINKEDIN_CLIENT_SECRET" : null,
    !env.LINKEDIN_REDIRECT_URI ? "LINKEDIN_REDIRECT_URI" : null
  ].filter((value): value is string => Boolean(value));

  return {
    configured: missing.length === 0,
    missing
  };
}

function resolveFrontendReturnUrl(req: { get: (header: string) => string | undefined }) {
  const referer = req.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      url.pathname = "/dashboard/portals";
      url.search = "";
      return url.toString();
    } catch {
      return `${env.FRONTEND_URL}/dashboard/portals`;
    }
  }

  return `${env.FRONTEND_URL}/dashboard/portals`;
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN
  } as jwt.SignOptions);
}

function signPasswordResetToken(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email, purpose: "password_reset" }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "30m"
  } as jwt.SignOptions);
}

router.post("/register", validate({ body: RegisterBody }), async (req, res, next) => {
  try {
    const { name, email, password } = req.body as z.infer<typeof RegisterBody>;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, matchThreshold: user.matchThreshold, agentEnabled: user.agentEnabled }
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", validate({ body: LoginBody }), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginBody>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, matchThreshold: user.matchThreshold, agentEnabled: user.agentEnabled }
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/forgot-password", validate({ body: ForgotPasswordBody }), async (req, res, next) => {
  try {
    const { email } = req.body as z.infer<typeof ForgotPasswordBody>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = signPasswordResetToken(user);
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const emailService = new EmailService();
      await emailService.sendPasswordReset(user.email, user.id, {
        name: user.name,
        resetUrl,
        expiresInMinutes: 30
      }).catch(() => false);
    }

    return res.json({
      success: true,
      message: "If an account exists for that email, a password reset link has been sent."
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/reset-password", validate({ body: ResetPasswordBody }), async (req, res) => {
  try {
    const { token, password } = req.body as z.infer<typeof ResetPasswordBody>;
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload["purpose"] !== "password_reset" || typeof payload.sub !== "string") {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash }
    });

    return res.json({ success: true, message: "Password updated successfully." });
  } catch {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }
});

router.get("/linkedin/status", (_req, res) => {
  const status = getLinkedInConfigStatus();
  return res.json({
    ...status,
    instructions:
      status.configured
        ? null
        : "Add the missing LinkedIn OAuth values to .env, then restart the API and web services before trying again."
  });
});

router.get("/linkedin", async (req, res, next) => {
  try {
    const configStatus = getLinkedInConfigStatus();
    if (!configStatus.configured) {
      const redirectUrl = new URL(resolveFrontendReturnUrl(req));
      redirectUrl.searchParams.set("linkedin", "not-configured");
      redirectUrl.searchParams.set("missing", configStatus.missing.join(","));
      return res.redirect(redirectUrl.toString());
    }
    const clientId = env.LINKEDIN_CLIENT_ID!;
    const redirectUri = env.LINKEDIN_REDIRECT_URI!;
    const state = Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "r_liteprofile r_emailaddress"
    });
    const url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    return res.redirect(url);
  } catch (err) {
    return next(err);
  }
});

router.get("/linkedin/callback", async (req, res, next) => {
  try {
    const code = typeof req.query["code"] === "string" ? (req.query["code"] as string) : null;
    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
      const redirectUrl = new URL(`${env.FRONTEND_URL}/dashboard/portals`);
      redirectUrl.searchParams.set("linkedin", "not-configured");
      return res.redirect(redirectUrl.toString());
    }

    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.LINKEDIN_REDIRECT_URI,
        client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 30000 }
    );
    const accessToken = tokenRes.data?.access_token as string | undefined;
    if (!accessToken) return res.status(500).json({ error: "LinkedIn token exchange failed" });

    // Best-effort email fetch
    let email = "";
    try {
      const emailRes = await axios.get("https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30000
      });
      email = String(emailRes.data?.elements?.[0]?.["handle~"]?.emailAddress ?? "");
    } catch {
      email = "";
    }

    const user = await prisma.user.upsert({
      where: { email: email || `linkedin_${Date.now()}@example.invalid` },
      update: email ? { email } : {},
      create: { email: email || `linkedin_${Date.now()}@example.invalid`, name: null }
    });

    // Store LinkedIn OAuth token in PortalCredential (encrypted)
    const enc = encrypt(JSON.stringify({ accessToken }), env.ENCRYPTION_KEY);
    await prisma.portalCredential.upsert({
      where: { userId_portalName: { userId: user.id, portalName: "linkedin" } },
      update: { encryptedData: enc, isActive: true },
      create: { userId: user.id, portalName: "linkedin", encryptedData: enc, isActive: true }
    });

    const jwtToken = signToken(user);
    const redirectTo =
      user.resumeText || user.profileJson ? `${env.FRONTEND_URL}/dashboard?token=${encodeURIComponent(jwtToken)}` : `${env.FRONTEND_URL}/onboarding?token=${encodeURIComponent(jwtToken)}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return next(err);
  }
});

export default router;

