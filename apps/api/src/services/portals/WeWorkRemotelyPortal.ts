import axios from "axios";
import * as cheerio from "cheerio";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class WeWorkRemotelyPortal extends BasePortal {
  readonly name = "weworkremotely";
  readonly displayName = "We Work Remotely";
  readonly logoUrl = "https://weworkremotely.com/assets/favicon-32.png";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    const base = "https://weworkremotely.com";
    const listUrl = `${base}/remote-jobs`;
    const html = (await axios.get(listUrl, { timeout: 30000 })).data as string;
    const $ = cheerio.load(html);
    const links: { title: string; company: string; url: string }[] = [];

    $("section.jobs li a").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href?.startsWith("/remote-jobs/")) return;
      const title = $(el).find("span.title").text().trim() || $(el).text().trim();
      const company = $(el).find("span.company").text().trim();
      if (!title || !company) return;
      links.push({ title, company, url: `${base}${href}` });
    });

    const unique = Array.from(new Map(links.map((l) => [l.url, l])).values()).slice(0, 25);
    const jobs: JobListing[] = [];

    for (const l of unique) {
      const jobHtml = (await axios.get(l.url, { timeout: 30000 })).data as string;
      const $$ = cheerio.load(jobHtml);
      const desc =
        $$(".listing-container .listing-container").text().trim() ||
        $$(".listing-container").text().trim() ||
        $$("body").text().trim();
      const applyHref =
        $$(".listing-container a[href*='apply']").attr("href") ||
        $$(".listing-container a:contains('Apply')").attr("href") ||
        l.url;
      const applyUrl = applyHref.startsWith("http") ? applyHref : `${base}${applyHref}`;

      jobs.push({
        portalName: this.name,
        externalId: l.url,
        title: l.title,
        company: l.company,
        companyLogoUrl: null,
        location: "Remote",
        description: desc.slice(0, 20000),
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

    return jobs;
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

      if (await this.detectCaptcha()) {
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

