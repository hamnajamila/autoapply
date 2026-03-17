import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../app";

jest.mock("../../config/database", () => ({
  prisma: {
    application: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => [])
    }
  }
}));

test("GET /api/applications returns paginated response", async () => {
  const app = createApp();
  const token = jwt.sign({ email: "u@example.com" }, process.env["JWT_SECRET"]!, { subject: "user1", expiresIn: "7d" });
  const r = await request(app).get("/api/applications?page=1&limit=25").set("Authorization", `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body.total).toBe(0);
  expect(Array.isArray(r.body.data)).toBe(true);
});

