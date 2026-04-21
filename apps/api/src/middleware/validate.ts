import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type Targets = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(schemas: Targets) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        }
        req.body = parsed.data;
      }
      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
        }
        req.query = parsed.data;
      }
      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid params", details: parsed.error.flatten() });
        }
        req.params = parsed.data;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

