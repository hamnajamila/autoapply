import type { UserProfile } from "@autoapply/shared";
import { fillFormFields } from "../services/llm/formFiller";
import type { FormField } from "../services/automation/FormDetector";

test("formFiller heuristically maps basic identity fields", async () => {
  const fields: FormField[] = [
    { selector: "#name", label: "Full Name", type: "text", required: true },
    { selector: "#email", label: "Email", type: "email", required: true },
    { selector: "#phone", label: "Phone", type: "tel", required: false }
  ];

  const profile: UserProfile = {
    name: "Test Person",
    email: "test@example.com",
    phone: "+1 555 0100",
    summary: "Experienced professional.",
    skills: ["communication"],
    experience: [],
    education: [],
    certifications: [],
    languages: []
  };

  const filled = await fillFormFields(fields, profile, "Role Title");
  const bySel = new Map(filled.map((f) => [f.selector, f]));
  expect(bySel.get("#email")?.valueToFill).toBe("test@example.com");
  expect(bySel.get("#name")?.valueToFill).toBe("Test Person");
});

