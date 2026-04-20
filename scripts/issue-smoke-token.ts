import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({ where: { username: "Gideon" } });
  if (!user) { console.error("no user"); process.exit(1); }

  const plain = "rasel_" + randomBytes(24).toString("hex");
  const hash = await argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await prisma.apiToken.create({ data: { userId: user.id, name: "smoketest-" + Date.now(), tokenHash: hash, prefix: plain.slice(0, 8) } });
  console.log("TOKEN=" + plain);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
