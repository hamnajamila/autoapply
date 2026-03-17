import { decrypt } from "@autoapply/shared";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { PortalRegistry } from "../portals/PortalRegistry";
import { enqueueScrape } from "../../workers/queues";

export class AgentOrchestrator {
  async runForUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        portalCredentials: { where: { isActive: true } }
      }
    });
    if (!user) return;

    const profile = user.profileJson as any;
    if (!profile) {
      logger.info("Agent: no profileJson, skipping", { userId });
      return;
    }

    const activePortalNames = user.portalCredentials.map((c) => c.portalName);
    for (const portalName of activePortalNames) {
      try {
        // Validate portal exists early
        PortalRegistry.get(portalName);
        await enqueueScrape({ userId, portalName });
      } catch (err) {
        await prisma.errorLog.create({
          data: {
            context: "AgentOrchestrator.enqueueScrape",
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack ?? null : null,
            metadata: { userId, portalName }
          }
        }).catch(() => undefined);
      }
    }

    // Update last run timestamp
    try {
      await prisma.user.update({ where: { id: userId }, data: { lastAgentRun: new Date() } });
    } catch (err) {
      logger.error("Failed updating lastAgentRun", { err });
    }
  }

  decryptPortalCredentials(encryptedData: string): Record<string, string> {
    const json = decrypt(encryptedData, env.ENCRYPTION_KEY);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
}

