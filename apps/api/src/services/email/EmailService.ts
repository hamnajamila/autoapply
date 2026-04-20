import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

type SuccessPayload = {
  jobTitle: string;
  company: string;
  portalName: string;
  matchScore: number;
  matchReasons: string[];
  jobUrl: string;
  appliedAt: string;
};

type FailedPayload = {
  jobTitle: string;
  company: string;
  portalName: string;
  jobUrl: string;
  error: string;
};

type CaptchaPayload = {
  jobTitle: string;
  company: string;
  jobUrl: string;
};

type DigestPayload = {
  totalApplied: number;
  topMatches: Array<{ company: string; jobTitle: string; score: number }>;
  failedCount: number;
};

type PasswordResetPayload = {
  name?: string | null;
  resetUrl: string;
  expiresInMinutes: number;
};

function dashboardUrl() {
  return `${env.FRONTEND_URL}/dashboard`;
}

function pauseUrl() {
  return `${env.FRONTEND_URL}/dashboard/settings`;
}

function templatePath(name: string) {
  return path.join(__dirname, "templates", name);
}

async function loadTemplate(name: string) {
  return fs.readFile(templatePath(name), "utf8");
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

function fill(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((accumulator, [key, value]) => {
    return accumulator.replaceAll(`{{${key}}}`, value);
  }, template);
}

async function sendWithResend(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY) return { ok: false as const, error: "RESEND_API_KEY not set" };

  const resend = new Resend(env.RESEND_API_KEY);
  const response = await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html
  });

  if ((response as { error?: { message?: string } }).error) {
    return { ok: false as const, error: String((response as { error?: { message?: string } }).error?.message ?? "resend_error") };
  }

  return { ok: true as const };
}

async function sendWithSMTP(to: string, subject: string, html: string) {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    return { ok: false as const, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: env.FROM_EMAIL,
    to,
    subject,
    html
  });

  return { ok: true as const };
}

async function persistEmailLog(
  userId: string,
  recipientEmail: string,
  subject: string,
  templateName: string,
  success: boolean,
  errorMessage?: string
) {
  try {
    await prisma.emailLog.create({
      data: {
        userId,
        recipientEmail,
        subject,
        templateName,
        success,
        errorMessage: errorMessage ?? null
      }
    });
  } catch (error) {
    logger.error("Failed to persist EmailLog", { error });
  }
}

async function deliverEmail(to: string, subject: string, html: string) {
  const smtpResult = await sendWithSMTP(to, subject, html).catch((error) => ({
    ok: false as const,
    error: String(error)
  }));
  if (smtpResult.ok) return smtpResult;

  return sendWithResend(to, subject, html).catch((error) => ({
    ok: false as const,
    error: String(error)
  }));
}

export class EmailService {
  async sendApplicationSuccess(to: string, userId: string, payload: SuccessPayload) {
    const template = await loadTemplate("applicationSuccess.html");
    const reasons = payload.matchReasons.slice(0, 3);

    const html = fill(template, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      portalName: escapeHtml(payload.portalName),
      matchScore: String(payload.matchScore),
      reason1: escapeHtml(reasons[0] ?? "Strong overall fit based on profile alignment."),
      reason2: escapeHtml(reasons[1] ?? "The profile and role responsibilities align well."),
      reason3: escapeHtml(reasons[2] ?? "Key requirements were covered by the candidate profile."),
      jobUrl: payload.jobUrl,
      appliedAt: escapeHtml(payload.appliedAt),
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `AutoApply: Applied to ${payload.jobTitle} at ${payload.company}`;

    const delivery = await deliverEmail(to, subject, html);
    await persistEmailLog(userId, to, subject, "applicationSuccess", delivery.ok, delivery.ok ? undefined : delivery.error);
    return delivery.ok;
  }

  async sendApplicationFailed(to: string, userId: string, payload: FailedPayload) {
    const template = await loadTemplate("applicationFailed.html");
    const html = fill(template, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      portalName: escapeHtml(payload.portalName),
      jobUrl: payload.jobUrl,
      error: escapeHtml(payload.error),
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `AutoApply: Failed to apply to ${payload.jobTitle} at ${payload.company}`;

    const delivery = await deliverEmail(to, subject, html);
    await persistEmailLog(userId, to, subject, "applicationFailed", delivery.ok, delivery.ok ? undefined : delivery.error);
    return delivery.ok;
  }

  async sendCaptchaRequired(to: string, userId: string, payload: CaptchaPayload) {
    const template = await loadTemplate("captchaRequired.html");
    const html = fill(template, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      jobUrl: payload.jobUrl,
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `AutoApply: Manual action needed for ${payload.jobTitle} at ${payload.company}`;

    const delivery = await deliverEmail(to, subject, html);
    await persistEmailLog(userId, to, subject, "captchaRequired", delivery.ok, delivery.ok ? undefined : delivery.error);
    return delivery.ok;
  }

  async sendWeeklyDigest(to: string, userId: string, payload: DigestPayload) {
    const template = await loadTemplate("weeklyDigest.html");
    const topMatches = payload.topMatches.slice(0, 3);

    const html = fill(template, {
      totalApplied: String(payload.totalApplied),
      failedCount: String(payload.failedCount),
      topMatchCount: String(topMatches.length),
      topMatch1: topMatches[0]
        ? escapeHtml(`${topMatches[0].jobTitle} at ${topMatches[0].company} (${topMatches[0].score})`)
        : "No standout matches recorded this week.",
      topMatch2: topMatches[1]
        ? escapeHtml(`${topMatches[1].jobTitle} at ${topMatches[1].company} (${topMatches[1].score})`)
        : "Keep your portals connected to improve coverage.",
      topMatch3: topMatches[2]
        ? escapeHtml(`${topMatches[2].jobTitle} at ${topMatches[2].company} (${topMatches[2].score})`)
        : "Update your profile regularly to improve match quality.",
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = "Your AutoApply weekly summary";

    const delivery = await deliverEmail(to, subject, html);
    await persistEmailLog(userId, to, subject, "weeklyDigest", delivery.ok, delivery.ok ? undefined : delivery.error);
    return delivery.ok;
  }

  async sendPasswordReset(to: string, userId: string, payload: PasswordResetPayload) {
    const template = await loadTemplate("passwordReset.html");
    const html = fill(template, {
      name: escapeHtml(payload.name?.trim() || "there"),
      resetUrl: payload.resetUrl,
      expiresInMinutes: String(payload.expiresInMinutes),
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = "AutoApply password reset";

    const delivery = await deliverEmail(to, subject, html);
    await persistEmailLog(userId, to, subject, "passwordReset", delivery.ok, delivery.ok ? undefined : delivery.error);
    return delivery.ok;
  }
}
