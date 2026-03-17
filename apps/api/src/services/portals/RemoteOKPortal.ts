import axios from "axios";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class RemoteOKPortal extends BasePortal {
  readonly name = "remoteok";
  readonly displayName = "RemoteOK";
  readonly logoUrl = "https://remoteok.com/assets/remoteok-48.png";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    const res = await axios.get("https://remoteok.com/api", {
      headers: {
        "User-Agent": "AutoApply/1.0 (+https://localhost)"
      },
      timeout: 30000
    });
    const arr = Array.isArray(res.data) ? res.data : [];
    const jobs = arr
      .filter((j) => j && typeof j === "object" && "id" in j && "position" in j)
      .map((j: any) => {
        const id = String(j.id);
        return {
          portalName: this.name,
          externalId: id,
          title: String(j.position ?? ""),
          company: String(j.company ?? ""),
          companyLogoUrl: j.company_logo ? String(j.company_logo) : null,
          location: "Remote",
          description: String(j.description ?? ""),
          applyUrl: String(j.url ?? ""),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          jobType: null,
          tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
          isRemote: true,
          postedAt: j.date ? new Date(j.date).toISOString() : null
        } satisfies JobListing;
      })
      .filter((j) => j.title && j.company && j.applyUrl);

    return jobs.slice(0, 50);
  }

  async isLoggedIn(): Promise<boolean> {
    return true;
  }

  async login(): Promise<void> {
    return;
  }

  async applyToJob(job: JobListing, profile: UserProfile, resumePath: string): Promise<ApplicationResult> {
    await this.initBrowser();
    try {
      await this.safeGoto(job.applyUrl);
      await this.randomDelay();

      const captcha = await this.detectCaptcha();
      if (captcha) {
        const before = await this.takeScreenshot();
        return { success: false, status: "SKIPPED_CAPTCHA", method: "captcha", screenshotBefore: before };
      }

      const fields = await FormDetector.getFields(this.page!);
      const filled = await fillFormFields(fields, profile, job.title);
      const submit = await FormSubmitter.submit(this.page!, filled, resumePath);
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

