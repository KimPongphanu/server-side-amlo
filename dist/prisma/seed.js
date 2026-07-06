"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// prisma/seed.ts
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
require("dotenv/config");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is not defined in environment variables');
    console.error('Please create a .env file with DATABASE_URL=postgresql://...');
    process.exit(1);
}
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function generateRecoveryKeys() {
    const keys = [];
    for (let i = 0; i < 10; i++) {
        keys.push(crypto_1.default.randomBytes(8).toString('hex').toUpperCase());
    }
    return keys;
}
async function main() {
    console.log('Starting seeding...');
    const supervisorExists = await prisma.user.findFirst({
        where: { role: 'SUPERVISOR' },
    });
    if (!supervisorExists) {
        const hashedPassword = await bcryptjs_1.default.hash('SuperSecurePassword123!@#', 12);
        const recoveryKeyStrings = generateRecoveryKeys();
        const rootSupervisor = await prisma.user.create({
            data: {
                email: 'tanut02059@gmail.com',
                password: hashedPassword,
                firstname: 'System',
                lastname: 'Supervisor',
                role: 'SUPERVISOR',
                twoFactorMethod: 'NONE',
                twoFactorEnabled: false,
                forcePasswordReset: false,
            },
        });
        for (const keyString of recoveryKeyStrings) {
            const keyHash = await bcryptjs_1.default.hash(keyString, 12);
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            await prisma.recoveryKey.create({
                data: {
                    userId: rootSupervisor.id,
                    keyHash: keyHash,
                    expiresAt: expiresAt,
                },
            });
        }
        console.log('Supervisor created:');
        console.log(`  Email: tanut02059@gmail.com`);
        console.log(`  Password: SuperSecurePassword123!@#`);
        console.log(`  Recovery Keys (SAVE THESE NOW):`);
        recoveryKeyStrings.forEach((key, idx) => {
            console.log(`    ${idx + 1}. ${key}`);
        });
        console.log('');
        console.log('IMPORTANT: These recovery keys are shown only once.');
        console.log('Print and store them in a secure location.');
    }
    else {
        console.log('Supervisor already exists. Skipping...');
    }
    const adminExists = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });
    if (!adminExists) {
        const hashedPassword = await bcryptjs_1.default.hash('AdminPassword123!', 12);
        await prisma.user.create({
            data: {
                email: 's6604062663124@email.kmutnb.ac.th',
                password: hashedPassword,
                firstname: 'System',
                lastname: 'Admin',
                role: 'ADMIN',
                twoFactorMethod: 'NONE',
                twoFactorEnabled: false,
                forcePasswordReset: true,
            },
        });
        console.log('Default Admin created:');
        console.log(`  Email: s6604062663183@email.kmutnb.ac.th`);
        console.log(`  Password: AdminPassword123!`);
    }
    else {
        console.log('Admin already exists. Skipping...');
    }
    console.log('Seeding finished.');
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error('Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map