import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { apiRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { mountRoutes } from "./routes";
import { env } from "./config/env";

function createAllowedOrigins() {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  const allowedOrigins = new Set<string>(["http://localhost:3000", "http://127.0.0.1:3000"]);

  const addOrigin = (value?: string) => {
    if (!value) {
      return;
    }

    try {
      const parsed = new URL(value);
      allowedOrigins.add(parsed.origin);

      if (localHosts.has(parsed.hostname)) {
        for (const host of localHosts) {
          allowedOrigins.add(`${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}`);
        }
      }
    } catch {
      // Ignore malformed values and continue with other origins.
    }
  };

  addOrigin(env.FRONTEND_URL);
  addOrigin(env.NEXTAUTH_URL);

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

        try {
          const parsedOrigin = new URL(origin);
          if (parsedOrigin.hostname.endsWith("trycloudflare.com")) {
            callback(null, true);
            return;
          }
          if (env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname)) {
            callback(null, true);
            return;
          }
        } catch {
          // Continue to blocked-origin response below.
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

