import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthUser = { userId: string; email?: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const userId = payload.sub ?? (payload["userId"] as unknown);
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const email = typeof payload["email"] === "string" ? (payload["email"] as string) : undefined;
    req.auth = email ? { userId, email } : { userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

