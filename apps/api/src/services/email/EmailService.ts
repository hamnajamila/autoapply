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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fill(tpl: string, vars: Record<string, string>) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

async function sendWithResend(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY) return { ok: false as const, error: "RESEND_API_KEY not set" };
  const resend = new Resend(env.RESEND_API_KEY);
  const res = await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html
  });
  if ((res as any)?.error) return { ok: false as const, error: String((res as any).error?.message ?? "resend_error") };
  return { ok: true as const };
}

async function sendWithSMTP(to: string, subject: string, html: string) {
  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!host || !port || !user || !pass) return { ok: false as const, error: "SMTP not configured" };
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  await transporter.sendMail({
    from: env.FROM_EMAIL,
    to,
    subject,
    html
  });
  return { ok: true as const };
}

async function persistEmailLog(userId: string, to: string, subject: string, templateName: string, success: boolean, errorMessage?: string) {
  try {
    await prisma.emailLog.create({
      data: { userId, recipientEmail: to, subject, templateName, success, errorMessage: errorMessage ?? null }
    });
  } catch (err) {
    logger.error("Failed to persist EmailLog", { err });
  }
}

export class EmailService {
  async sendApplicationSuccess(to: string, userId: string, payload: SuccessPayload) {
    const tpl = await loadTemplate("applicationSuccess.html");
    const reasonsLi = payload.matchReasons
      .slice(0, 5)
      .map((r) => `<li style="margin:0 0 6px 0;">${escapeHtml(r)}</li>`)
      .join("");
    const html = fill(tpl, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      portalName: escapeHtml(payload.portalName),
      matchScore: String(payload.matchScore),
      matchReasonsLi: reasonsLi || `<li style="margin:0 0 6px 0;">Strong overall fit based on profile alignment.</li>`,
      jobUrl: payload.jobUrl,
      appliedAt: escapeHtml(payload.appliedAt),
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `✅ AutoApply: Applied to ${payload.jobTitle} at ${payload.company}`;

    const res = await sendWithResend(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    const final = res.ok ? res : await sendWithSMTP(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    await persistEmailLog(userId, to, subject, "applicationSuccess", final.ok, final.ok ? undefined : final.error);
    return final.ok;
  }

  async sendApplicationFailed(to: string, userId: string, payload: FailedPayload) {
    const tpl = await loadTemplate("applicationFailed.html");
    const html = fill(tpl, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      portalName: escapeHtml(payload.portalName),
      jobUrl: payload.jobUrl,
      error: escapeHtml(payload.error),
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `⚠️ AutoApply: Failed to apply to ${payload.jobTitle} at ${payload.company}`;

    const res = await sendWithResend(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    const final = res.ok ? res : await sendWithSMTP(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    await persistEmailLog(userId, to, subject, "applicationFailed", final.ok, final.ok ? undefined : final.error);
    return final.ok;
  }

  async sendCaptchaRequired(to: string, userId: string, payload: CaptchaPayload) {
    const tpl = await loadTemplate("captchaRequired.html");
    const html = fill(tpl, {
      company: escapeHtml(payload.company),
      jobTitle: escapeHtml(payload.jobTitle),
      jobUrl: payload.jobUrl,
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = `🔒 AutoApply: Manual action needed for ${payload.jobTitle} at ${payload.company}`;

    const res = await sendWithResend(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    const final = res.ok ? res : await sendWithSMTP(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    await persistEmailLog(userId, to, subject, "captchaRequired", final.ok, final.ok ? undefined : final.error);
    return final.ok;
  }

  async sendWeeklyDigest(to: string, userId: string, payload: DigestPayload) {
    const tpl = await loadTemplate("weeklyDigest.html");
    const rows = payload.topMatches
      .slice(0, 8)
      .map(
        (m) =>
          `<tr>` +
          `<td style="padding:8px 0;color:#e2e8f0;font-size:12px;border-bottom:1px solid rgba(255,255,255,.06);">${escapeHtml(m.company)}</td>` +
          `<td style="padding:8px 0;color:#e2e8f0;font-size:12px;border-bottom:1px solid rgba(255,255,255,.06);">${escapeHtml(m.jobTitle)}</td>` +
          `<td style="padding:8px 0;color:#ffffff;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid rgba(255,255,255,.06);">${m.score}</td>` +
          `</tr>`
      )
      .join("");
    const html = fill(tpl, {
      totalApplied: String(payload.totalApplied),
      failedCount: String(payload.failedCount),
      topMatchesRows: rows || `<tr><td colspan="3" style="padding:10px 0;color:#e2e8f0;font-size:12px;">No matches yet.</td></tr>`,
      dashboardUrl: dashboardUrl(),
      pauseUrl: pauseUrl()
    });
    const subject = "📊 Your AutoApply weekly summary";

    const res = await sendWithResend(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    const final = res.ok ? res : await sendWithSMTP(to, subject, html).catch((e) => ({ ok: false as const, error: String(e) }));
    await persistEmailLog(userId, to, subject, "weeklyDigest", final.ok, final.ok ? undefined : final.error);
    return final.ok;
  }
}

