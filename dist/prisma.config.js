"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("@prisma/config");
exports.default = (0, config_1.defineConfig)({
    schema: "prisma/schema.prisma",
    migrations: {
        seed: "npx tsx prisma/seed.ts",
    },
    datasource: {
        url: (0, config_1.env)("DATABASE_URL") || process.env.DATABASE_URL || "postgresql://postgres:12345@postgres:5432/backend_amlo",
    },
});
//# sourceMappingURL=prisma.config.js.map