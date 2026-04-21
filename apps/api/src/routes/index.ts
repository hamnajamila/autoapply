import type { Express } from "express";
import { Router } from "express";
import authRouter from "./auth";
import profileRouter from "./profile";
import portalsRouter from "./portals";
import customPortalsRouter from "./customPortals";
import applicationsRouter from "./applications";
import agentRouter from "./agent";
import dashboardRouter from "./dashboard";
import youthOpportunitiesRouter from "./youthOpportunities";
import govJobsRouter from "./govJobs";
import answerStoreRouter from "./answerStore";
import notificationsRouter from "./notifications";

export function mountRoutes(app: Express) {
  const api = Router();

  api.use("/auth", authRouter);
  api.use("/profile", profileRouter);
  api.use("/portals", portalsRouter);
  api.use("/custom-portals", customPortalsRouter);
  api.use("/applications", applicationsRouter);
  api.use("/agent", agentRouter);
  api.use("/dashboard", dashboardRouter);
  api.use("/youth", youthOpportunitiesRouter);
  api.use("/gov-jobs", govJobsRouter);
  api.use("/answer-store", answerStoreRouter);
  api.use("/notifications", notificationsRouter);

  app.use("/api", api);
}

