import { prisma } from "../../config/database";

export class JobDeduplicator {
  static async alreadyApplied(userId: string, portalName: string, company: string, title: string): Promise<boolean> {
    const existing = await prisma.application.findFirst({
      where: {
        userId,
        job: { portalName, company, title },
        status: { in: ["SUBMITTED", "UNCERTAIN"] }
      },
      select: { id: true }
    });
    return Boolean(existing);
  }
}

