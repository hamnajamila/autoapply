import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { apiRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { mountRoutes } from "./routes";
import { env } from "./config/env";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true
    })
  );
  app.use(helmet());
  app.use(apiRateLimit);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      redact: ["req.headers.authorization"]
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  mountRoutes(app);

  app.use(errorHandler);
  return app;
}

