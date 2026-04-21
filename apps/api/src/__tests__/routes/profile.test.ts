import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../app";

const user = {
  id: "user1",
  email: "user1@example.com",
  name: "User One",
  resumeFileUrl: null,
  resumeText: null,
  profileJson: null,
  preferences: null,
  matchThreshold: 70,
  agentSchedule: "0 */2 * * *",
  agentEnabled: false,
  emailNotifications: true
};

jest.mock("../../config/database", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(user, data);
        return user;
      })
    }
  }
}));

test("GET /api/profile returns user profile", async () => {
  const app = createApp();
  const token = jwt.sign({ email: user.email }, process.env["JWT_SECRET"]!, { subject: user.id, expiresIn: "7d" });
  const r = await request(app).get("/api/profile").set("Authorization", `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body.email).toBe(user.email);
});

test("PUT /api/profile updates preferences", async () => {
  const app = createApp();
  const token = jwt.sign({ email: user.email }, process.env["JWT_SECRET"]!, { subject: user.id, expiresIn: "7d" });
  const r = await request(app)
    .put("/api/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ preferences: { blockedCompanies: ["ExampleCo"] }, matchThreshold: 75 });
  expect(r.status).toBe(200);
  expect(r.body.matchThreshold).toBe(75);
});

