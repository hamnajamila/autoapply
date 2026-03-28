import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { apiRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { mountRoutes } from "./routes";
import { env } from "./config/env";

function createAllowedOrigins() {
  const frontendUrl = new URL(env.FRONTEND_URL);
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  const allowedOrigins = new Set<string>([frontendUrl.origin]);

  if (localHosts.has(frontendUrl.hostname)) {
    for (const host of localHosts) {
      allowedOrigins.add(`${frontendUrl.protocol}//${host}${frontendUrl.port ? `:${frontendUrl.port}` : ""}`);
    }
  }

  return allowedOrigins;
}

export function createApp() {
  const app = express();
  const allowedOrigins = createAllowedOrigins();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
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

