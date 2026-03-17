import type { Express } from "express";
import { Router } from "express";
import authRouter from "./auth";
import profileRouter from "./profile";
import portalsRouter from "./portals";
import applicationsRouter from "./applications";
import agentRouter from "./agent";
import dashboardRouter from "./dashboard";

export function mountRoutes(app: Express) {
  const api = Router();

  api.use("/auth", authRouter);
  api.use("/profile", profileRouter);
  api.use("/portals", portalsRouter);
  api.use("/applications", applicationsRouter);
  api.use("/agent", agentRouter);
  api.use("/dashboard", dashboardRouter);

  app.use("/api", api);
}

