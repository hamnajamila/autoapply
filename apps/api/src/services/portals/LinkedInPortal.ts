import axios from "axios";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

type LinkedInCredentials = {
  accessToken?: string;
};

export class LinkedInPortal extends BasePortal {
  readonly name = "linkedin";
  readonly displayName = "LinkedIn";
  readonly logoUrl = "https://static.licdn.com/sc/h/2if24wp7oqlodqdlgei1n1520";
  readonly requiresAuth = true;

  private accessToken: string | null = null;

  async isLoggedIn(): Promise<boolean> {
    if (this.accessToken) return true;
    if (!this.page) return false;
    const hasMe = await this.page.locator('a[href*="/me"], img[alt*="Me"]').first().isVisible().catch(() => false);
    return hasMe;
  }

  async login(credentials: Record<string, string>): Promise<void> {
    this.accessToken = (credentials as LinkedInCredentials).accessToken ?? null;
    // Browser/session login is handled via cookies restored in initBrowser().
    if (!this.accessToken && this.requiresAuth) {
      throw new Error("missing_linkedin_access_token");
    }
  }

  async scrapeJobs(profile?: UserProfile): Promise<JobListing[]> {
    if (!this.accessToken) throw new Error("missing_linkedin_access_token");
    const topSkills = (profile?.skills ?? []).slice(0, 5);
    const keywords = topSkills.length ? topSkills : [profile?.summary?.split(" ").slice(0, 3).join(" ") ?? "remote"];

    const all: JobListing[] = [];
    for (const kw of keywords) {
      const res = await axios.get("https://api.linkedin.com/v2/jobSearch", {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: {
          keywords: kw,
          remote: true,
          count: 25
        },
        timeout: 30000
      });
      const items = Array.isArray(res.data?.elements) ? res.data.elements : [];
      for (const it of items) {
        const externalId = String(it?.entityUrn ?? it?.trackingId ?? it?.id ?? "");
        const title = String(it?.title ?? it?.jobTitle ?? "");
        const company = String(it?.companyDetails?.company ?? it?.companyName ?? "");
        const applyUrl =
          String(it?.applyUrl ?? "") ||
          (externalId ? `https://www.linkedin.com/jobs/view/${encodeURIComponent(externalId)}` : "");
        if (!externalId || !title || !company || !applyUrl) continue;
        all.push({
          portalName: this.name,
          externalId,
          title,
          company,
          companyLogoUrl: null,
          location: "Remote",
          description: String(it?.description ?? ""),
          applyUrl,
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          jobType: null,
          tags: [],
          isRemote: true,
          postedAt: null
        });
      }
    }
    const uniq = Array.from(new Map(all.map((j) => [j.externalId, j])).values());
    return uniq.slice(0, 50);
  }

  async applyToJob(job: JobListing, profile: UserProfile, resumePath: string): Promise<ApplicationResult> {
    await this.initBrowser();
    try {
      await this.safeGoto(job.applyUrl);
      await this.randomDelay();

      if (await this.detectCaptcha()) {
        const before = await this.takeScreenshot();
        return { success: false, status: "SKIPPED_CAPTCHA", method: "captcha", screenshotBefore: before };
      }

      const page = this.page!;
      const easyApply = page.locator('button:has-text("Easy Apply")').first();
      const externalApply = page.locator('a:has-text("Apply on company website"), button:has-text("Apply on company website")').first();

      if (await easyApply.isVisible().catch(() => false)) {
        await easyApply.click().catch(() => undefined);
        await this.randomDelay(1200, 2500);
        for (let step = 0; step < 6; step++) {
          const fields = await FormDetector.getFields(page);
          const filled = await fillFormFields(fields, profile, job.title);
          const submit = await FormSubmitter.submit(page, filled, resumePath);
          if (submit.success) {
            return {
              success: true,
              status: "SUBMITTED",
              method: "linkedin_easy_apply",
              screenshotBefore: submit.screenshotBefore,
              screenshotAfter: submit.screenshotAfter
            };
          }
          const next = page.locator('button:has-text("Next"), button:has-text("Review"), button:has-text("Continue")').first();
          if (await next.isVisible().catch(() => false)) {
            await next.click().catch(() => undefined);
            await this.randomDelay(1200, 2500);
            continue;
          }
          break;
        }
        const after = await this.takeScreenshot();
        return { success: false, status: "UNCERTAIN", method: "linkedin_easy_apply_uncertain", screenshotAfter: after };
      }

      if (await externalApply.isVisible().catch(() => false)) {
        const href = await externalApply.getAttribute("href").catch(() => null);
        if (href) await this.safeGoto(href);
        await this.randomDelay();
      }

      const fields = await FormDetector.getFields(page);
      if (fields.length > 15) {
        const filled = await fillFormFields(fields, profile, job.title);
        const fillable = filled.filter((f) => f.confidence >= 0.7).length;
        if (fillable < 8) {
          const before = await this.takeScreenshot();
          return {
            success: false,
            status: "SKIPPED_MANUAL",
            method: "external_form_too_complex",
            screenshotBefore: before,
            skipReason: "manual_required"
          };
        }
      }

      const filled = await fillFormFields(fields, profile, job.title);
      const submit = await FormSubmitter.submit(page, filled, resumePath);
      return {
        success: submit.success,
        status: submit.success ? "SUBMITTED" : "UNCERTAIN",
        method: submit.method,
        screenshotBefore: submit.screenshotBefore,
        screenshotAfter: submit.screenshotAfter
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "apply_failed";
      const before = this.page ? await this.takeScreenshot().catch(() => "") : "";
      return { success: false, status: msg === "captcha_required" ? "SKIPPED_CAPTCHA" : "FAILED", method: "error", errorMessage: msg, screenshotBefore: before };
    } finally {
      await this.closeBrowser();
    }
  }
}

