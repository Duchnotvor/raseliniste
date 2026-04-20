import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createClient();
    if (env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  }
  return globalForPrisma.prisma;
}

// Lazy proxy — Prisma klient se instancuje až při prvním použití, ne při importu.
// Díky tomu `next build` (collect page data) nevyžaduje DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop: string | symbol) {
    const client = getPrisma();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
}) as PrismaClient;
