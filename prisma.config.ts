import path from "node:path";
import { defineConfig } from "prisma/config";

// datasource.url se konzumuje jen migrate/db commands. Pro `prisma generate`
// (běží i v Dockeru bez DB) nechceme tvrdou validaci — proto process.env
// s fallbackem na prázdný string místo env() helperu, který by hodil výjimku.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
