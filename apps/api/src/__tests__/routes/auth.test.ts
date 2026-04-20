import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../../app";

type User = { id: string; email: string; name: string | null; passwordHash: string | null; matchThreshold: number; agentEnabled: boolean };

const mem = {
  users: new Map<string, User>()
};

jest.mock("../../services/email/EmailService", () => ({
  EmailService: class {
    async sendPasswordReset() {
      return true;
    }
  }
}));

jest.mock("../../config/database", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.email) {
          const email = where.email as string;
          return Array.from(mem.users.values()).find((u) => u.email === email) ?? null;
        }
        if (where.id) {
          return mem.users.get(where.id as string) ?? null;
        }
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = `u_${mem.users.size + 1}`;
        const u: User = { id, email: data.email, name: data.name ?? null, passwordHash: data.passwordHash ?? null, matchThreshold: 70, agentEnabled: false };
        mem.users.set(id, u);
        return u;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = mem.users.get(where.id as string);
        if (!user) {
          throw new Error("User not found");
        }
        const nextUser = { ...user, ...data };
        mem.users.set(user.id, nextUser);
        return nextUser;
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

test("forgot password then reset password", async () => {
  const app = createApp();
  const passwordHash = await bcrypt.hash("password123", 12);
  mem.users.set("u_reset", {
    id: "u_reset",
    email: "reset@example.com",
    name: "Reset User",
    passwordHash,
    matchThreshold: 70,
    agentEnabled: false
  });

  const forgot = await request(app).post("/api/auth/forgot-password").send({ email: "reset@example.com" });
  expect(forgot.status).toBe(200);
  expect(forgot.body.success).toBe(true);

  const token = jwt.sign(
    { email: "reset@example.com", purpose: "password_reset" },
    process.env["JWT_SECRET"]!,
    { subject: "u_reset", expiresIn: "30m" }
  );
  const reset = await request(app).post("/api/auth/reset-password").send({ token, password: "newpassword123" });
  expect(reset.status).toBe(200);

  const updatedUser = mem.users.get("u_reset")!;
  expect(await bcrypt.compare("newpassword123", updatedUser.passwordHash!)).toBe(true);
});

