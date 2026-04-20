import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') AS ok`
  );
  if (!rows?.[0]?.ok) {
    process.exit(0);
  }
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL`
  );
  if (deleted > 0) {
    console.log(`[heal] removed ${deleted} stale failed migration row(s)`);
  }
} catch (err) {
  console.log("[heal] skip:", err?.message ?? err);
} finally {
  await prisma.$disconnect();
}
