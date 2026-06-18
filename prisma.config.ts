import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL") || process.env.DATABASE_URL || "postgresql://postgres:12345@postgres:5432/backend_amlo",
  },
});
