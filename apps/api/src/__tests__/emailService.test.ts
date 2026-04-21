import { EmailService } from "../services/email/EmailService";

jest.mock("../config/database", () => ({
  prisma: {
    emailLog: { create: jest.fn(async () => ({ id: "1" })) }
  }
}));

test("emailService logs email attempts", async () => {
  const svc = new EmailService();
  const ok = await svc.sendCaptchaRequired("test@example.com", "user1", {
    jobTitle: "Role",
    company: "Company",
    jobUrl: "https://example.com/job"
  });
  // With no RESEND/SMTP configured in unit tests, it will return false.
  expect(ok).toBe(false);
});

