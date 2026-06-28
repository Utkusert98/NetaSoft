import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "";
  
  if (!connectionString) {
    console.warn("[NetaSoft] DATABASE_URL is not set. Database operations will fail.");
    // Return minimal client for build-time (won't make DB calls)
    const adapter = new PrismaPg({ connectionString: "postgresql://localhost/neta_soft" });
    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
