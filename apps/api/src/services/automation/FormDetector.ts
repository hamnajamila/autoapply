import type { Page } from "playwright";

export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "file";

export type FormField = {
  selector: string;
  label: string;
  type: FormFieldType;
  options?: string[];
  required: boolean;
  currentValue?: string;
};

function normalizeLabel(label: string) {
  return label.replace(/\s+/g, " ").trim();
}

export class FormDetector {
  static async getFields(page: Page): Promise<FormField[]> {
    const fields = await page.evaluate(() => {
      const isVisible = (el: Element) => {
        const style = window.getComputedStyle(el as HTMLElement);
        const rect = (el as HTMLElement).getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };

      const labelFor = (el: HTMLElement) => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria;
        const ph = (el as HTMLInputElement).placeholder;
        if (ph) return ph;
        const id = el.getAttribute("id");
        if (id) {
          const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (explicit?.textContent) return explicit.textContent;
        }
        const wrapped = el.closest("label");
        if (wrapped?.textContent) return wrapped.textContent;
        const parentText = el.parentElement?.textContent;
        if (parentText) return parentText.slice(0, 120);
        return "";
      };

      const selectorFor = (el: HTMLElement) => {
        const id = el.getAttribute("id");
        if (id) return `#${CSS.escape(id)}`;
        const name = el.getAttribute("name");
        if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
        const dataTest = el.getAttribute("data-testid");
        if (dataTest) return `${el.tagName.toLowerCase()}[data-testid="${CSS.escape(dataTest)}"]`;
        const role = el.getAttribute("role");
        if (role) return `${el.tagName.toLowerCase()}[role="${CSS.escape(role)}"]`;
        // fallback: build a short path
        const parts: string[] = [];
        let cur: HTMLElement | null = el;
        for (let i = 0; i < 4 && cur; i++) {
          const tag = cur.tagName.toLowerCase();
          const siblings = Array.from(cur.parentElement?.children ?? []).filter(
            (c) => (c as HTMLElement).tagName.toLowerCase() === tag
          );
          const idx = siblings.indexOf(cur) + 1;
          parts.unshift(`${tag}:nth-of-type(${idx})`);
          cur = cur.parentElement;
          if (cur?.tagName.toLowerCase() === "form") break;
        }
        return parts.join(" > ");
      };

      const candidates = Array.from(
        document.querySelectorAll(
          'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="checkbox"], input[type="radio"], input[type="file"], textarea, select'
        )
      ) as HTMLElement[];

      const out: any[] = [];
      for (const el of candidates) {
        if (!isVisible(el)) continue;
        const tag = el.tagName.toLowerCase();
        const inputType = (el as HTMLInputElement).type?.toLowerCase();
        let type: string;
        if (tag === "textarea") type = "textarea";
        else if (tag === "select") type = "select";
        else if (inputType === "email") type = "email";
        else if (inputType === "tel") type = "tel";
        else if (inputType === "number") type = "number";
        else if (inputType === "checkbox") type = "checkbox";
        else if (inputType === "radio") type = "radio";
        else if (inputType === "file") type = "file";
        else type = "text";

        const rawLabel = labelFor(el);
        const required =
          el.hasAttribute("required") ||
          (rawLabel && rawLabel.includes("*")) ||
          el.getAttribute("aria-required") === "true";

        const entry: any = {
          selector: selectorFor(el),
          label: rawLabel ?? "",
          type,
          required,
          currentValue: (el as HTMLInputElement).value ?? ""
        };

        if (type === "select") {
          const opts = Array.from((el as HTMLSelectElement).options ?? []).map((o) => o.value || o.textContent || "");
          entry.options = opts.filter(Boolean).slice(0, 200);
        }
        if (type === "radio") {
          const name = (el as HTMLInputElement).name;
          if (name) {
            const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`)) as HTMLInputElement[];
            entry.options = radios
              .map((r) => r.value || r.getAttribute("aria-label") || r.id || "")
              .filter(Boolean)
              .slice(0, 50);
          }
        }

        out.push(entry);
        if (out.length >= 50) break;
      }
      return out;
    });

    return (fields as FormField[]).map((f) => ({
      ...f,
      label: normalizeLabel(f.label || "")
    }));
  }
}

