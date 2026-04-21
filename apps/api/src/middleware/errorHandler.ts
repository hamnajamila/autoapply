import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database";
import { logger } from "../config/logger";

export async function persistErrorLog(input: {
  context: string;
  message: string;
  stack?: string;
  metadata?: unknown;
}) {
  try {
    await prisma.errorLog.create({
      data: {
        context: input.context,
        message: input.message,
        stack: input.stack ?? null,
        metadata: input.metadata as any
      }
    });
  } catch (err) {
    logger.error("Failed to persist ErrorLog", { err });
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error("Unhandled error", {
    message,
    stack,
    path: req.path,
    method: req.method
  });

  void persistErrorLog({
    context: "api",
    message,
    ...(stack ? { stack } : {}),
    metadata: { path: req.path, method: req.method }
  });

  const status =
    typeof (err as any)?.statusCode === "number"
      ? (err as any).statusCode
      : typeof (err as any)?.status === "number"
        ? (err as any).status
        : 500;

  return res.status(status).json({ error: status === 500 ? "Internal Server Error" : message });
}

