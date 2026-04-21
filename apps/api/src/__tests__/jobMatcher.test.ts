import type { UserProfile } from "@autoapply/shared";
import { scoreJobMatch } from "../services/llm/jobMatcher";

test("jobMatcher returns bounded score + reasons", async () => {
  const profile: UserProfile = {
    name: "Test Person",
    email: "test@example.com",
    summary: "Experienced professional with strong communication and analysis skills.",
    skills: ["analysis", "communication", "research", "excel", "writing"],
    experience: [],
    education: [],
    certifications: [],
    languages: []
  };

  const jobDescription = `
    We are seeking someone with strong research and writing skills, comfort with Excel,
    and experience producing clear reports for stakeholders.
  `;

  const res = await scoreJobMatch(profile, jobDescription, "Analyst");
  expect(res.score).toBeGreaterThanOrEqual(0);
  expect(res.score).toBeLessThanOrEqual(100);
  expect(Array.isArray(res.reasons)).toBe(true);
  expect(res.reasons.length).toBeGreaterThan(0);
});

