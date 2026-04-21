import type { Locator, Page } from "playwright";
import type { FilledField } from "../llm/formFiller";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function takeBase64Screenshot(page: Page): Promise<string> {
  const buf = await page.screenshot({ fullPage: true, type: "png" });
  return buf.toString("base64");
}

async function hasVisibleErrors(page: Page): Promise<boolean> {
  const candidates = [
    '[aria-invalid="true"]',
    ".error",
    ".errors",
    ".field-error",
    ".input-error",
    '[role="alert"]',
    'text=/\\berror\\b/i',
    'text=/required\\b/i'
  ];
  for (const sel of candidates) {
    const vis = await page.locator(sel).first().isVisible().catch(() => false);
    if (vis) return true;
  }
  return false;
}

async function findSubmit(page: Page): Promise<Locator | null> {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
    'button:has-text("Send Application")'
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    const ok = await loc.isVisible().catch(() => false);
    if (ok) return loc;
  }
  return null;
}

export class FormSubmitter {
  static async submit(
    page: Page,
    filledFields: FilledField[],
    resumeFilePath: string
  ): Promise<{ success: boolean; method: string; screenshotBefore: string; screenshotAfter: string }> {
    // Step 2 (audit before)
    const screenshotBefore = await takeBase64Screenshot(page);

    for (const f of filledFields) {
      if (f.confidence < 0.7) continue;
      const loc = page.locator(f.selector).first();

      if (!(await loc.isVisible().catch(() => false))) continue;

      if (f.type === "file") {
        await loc.setInputFiles(resumeFilePath).catch(() => undefined);
      } else if (f.type === "select") {
        await loc.selectOption({ label: String(f.valueToFill) }).catch(async () => {
          await loc.selectOption(String(f.valueToFill)).catch(() => undefined);
        });
      } else if (f.type === "checkbox") {
        const desired = Boolean(f.valueToFill);
        const isChecked = await loc.isChecked().catch(() => false);
        if (desired && !isChecked) await loc.check().catch(() => undefined);
        if (!desired && isChecked) await loc.uncheck().catch(() => undefined);
      } else if (f.type === "radio") {
        await loc.click({ timeout: 5000 }).catch(() => undefined);
      } else {
        await loc.fill("").catch(() => undefined);
        await loc.fill(String(f.valueToFill)).catch(async () => {
          await loc.type(String(f.valueToFill), { delay: rand(10, 35) }).catch(() => undefined);
        });
      }

      await sleep(rand(200, 800));
    }

    if (await hasVisibleErrors(page)) {
      const screenshotAfter = await takeBase64Screenshot(page);
      return { success: false, method: "precheck_failed", screenshotBefore, screenshotAfter };
    }

    const submit = await findSubmit(page);
    if (!submit) {
      const screenshotAfter = await takeBase64Screenshot(page);
      return { success: false, method: "submit_not_found", screenshotBefore, screenshotAfter };
    }

    await submit.click({ timeout: 10000 }).catch(() => undefined);

    const startedAt = Date.now();
    const successSignals = [/thank/i, /success/i, /confirmation/i, /applied/i];
    while (Date.now() - startedAt < 15000) {
      const url = page.url();
      if (successSignals.some((r) => r.test(url))) break;
      const content = await page.content().catch(() => "");
      if (
        /thank you|application received|successfully applied|we'll be in touch|application submitted/i.test(content)
      ) {
        break;
      }
      await sleep(750);
    }

    const screenshotAfter = await takeBase64Screenshot(page);
    const finalContent = await page.content().catch(() => "");
    const finalUrl = page.url();
    const success =
      successSignals.some((r) => r.test(finalUrl)) ||
      /thank you|application received|successfully applied|we'll be in touch|application submitted/i.test(finalContent);

    return { success, method: "form_submit", screenshotBefore, screenshotAfter };
  }
}

