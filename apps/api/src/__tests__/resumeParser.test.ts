import { parseResumeText } from "../services/llm/resumeParser";

test("resumeParser extracts email heuristically without LLM", async () => {
  const text = `
    Jane Doe
    jane.doe@example.com
    +1 (555) 123-4567

    Skills
    Communication, Research, Writing, Excel
  `;
  const profile = await parseResumeText(text, undefined);
  expect(profile.email).toBe("jane.doe@example.com");
  expect(profile.name.toLowerCase()).toContain("jane");
  expect(profile.skills.length).toBeGreaterThan(0);
});

