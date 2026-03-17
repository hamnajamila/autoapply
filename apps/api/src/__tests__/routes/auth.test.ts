import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../app";

type User = { id: string; email: string; name: string | null; passwordHash: string | null; matchThreshold: number; agentEnabled: boolean };

const mem = {
  users: new Map<string, User>()
};

jest.mock("../../config/database", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        const email = where.email as string;
        return Array.from(mem.users.values()).find((u) => u.email === email) ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = `u_${mem.users.size + 1}`;
        const u: User = { id, email: data.email, name: data.name ?? null, passwordHash: data.passwordHash ?? null, matchThreshold: 70, agentEnabled: false };
        mem.users.set(id, u);
        return u;
      })
    }
  }
}));

test("register then login", async () => {
  const app = createApp();
  const r = await request(app).post("/api/auth/register").send({ name: "A", email: "a@example.com", password: "password123" });
  expect(r.status).toBe(201);
  expect(r.body.token).toBeTruthy();

  const u = Array.from(mem.users.values())[0]!;
  // Patch stored hash to match bcrypt behavior in mocked create
  u.passwordHash = await bcrypt.hash("password123", 12);

  const l = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: "password123" });
  expect(l.status).toBe(200);
  expect(l.body.token).toBeTruthy();
});

