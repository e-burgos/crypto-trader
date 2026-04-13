import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { AGENT_SEEDS } from './seed/agents';

const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── Admin users ──────────────────────────────────────────────────────────

    const adminPassword = await bcrypt.hash('admin123', BCRYPT_SALT_ROUNDS);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@cryptotrader.dev' },
      update: {},
      create: {
        email: 'admin@cryptotrader.dev',
        passwordHash: adminPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Admin user: ${admin.email} / admin123`);

    // Short-alias admin for quick testing
    const adminShortPassword = await bcrypt.hash(
      'Admin1234!',
      BCRYPT_SALT_ROUNDS,
    );
    const adminShort = await prisma.user.upsert({
      where: { email: 'admin@crypto.com' },
      update: {},
      create: {
        email: 'admin@crypto.com',
        passwordHash: adminShortPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Admin user: ${adminShort.email} / Admin1234!`);

    // ── Trader users ─────────────────────────────────────────────────────────

    const traderPassword = await bcrypt.hash('trader123', BCRYPT_SALT_ROUNDS);
    const trader = await prisma.user.upsert({
      where: { email: 'trader@cryptotrader.dev' },
      update: {},
      create: {
        email: 'trader@cryptotrader.dev',
        passwordHash: traderPassword,
        role: 'TRADER',
        isActive: true,
      },
    });
    console.log(`Trader user: ${trader.email} / trader123`);

    // Short-alias trader for quick testing
    const traderShortPassword = await bcrypt.hash(
      'Trader1234!',
      BCRYPT_SALT_ROUNDS,
    );
    const traderShort = await prisma.user.upsert({
      where: { email: 'trader@crypto.com' },
      update: {},
      create: {
        email: 'trader@crypto.com',
        passwordHash: traderShortPassword,
        role: 'TRADER',
        isActive: true,
      },
    });
    console.log(`Trader user: ${traderShort.email} / Trader1234!`);

    // ── Trading configs (for all trader users) ────────────────────────────────

    for (const t of [trader, traderShort]) {
      await prisma.tradingConfig.upsert({
        where: {
          userId_asset_pair: {
            userId: t.id,
            asset: 'BTC',
            pair: 'USDT',
          },
        },
        update: {},
        create: {
          userId: t.id,
          asset: 'BTC',
          pair: 'USDT',
          buyThreshold: 70,
          sellThreshold: 70,
          stopLossPct: 0.03,
          takeProfitPct: 0.05,
          maxTradePct: 0.05,
          maxConcurrentPositions: 2,
          minIntervalMinutes: 15,
          mode: 'SANDBOX',
          isRunning: false,
        },
      });
      console.log(`Sandbox trading config created for ${t.email} (BTC/USDT)`);
    }

    // ── Agent Definitions (Spec 28) ──────────────────────────────────────────
    for (const agent of AGENT_SEEDS) {
      await prisma.agentDefinition.upsert({
        where: { id: agent.id },
        update: {
          displayName: agent.displayName,
          description: agent.description,
          skills: agent.skills,
          isActive: agent.isActive,
          // systemPrompt is NOT updated on re-seed to preserve Admin customizations
        },
        create: {
          id: agent.id,
          displayName: agent.displayName,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          skills: agent.skills,
          isActive: agent.isActive,
        },
      });
      console.log(`Agent: ${agent.displayName} (${agent.id})`);
    }

    console.log('\n✅ Seed completado!');
    console.log('─────────────────────────────────────────');
    console.log('  admin@crypto.com        / Admin1234!  (ADMIN)');
    console.log('  admin@cryptotrader.dev  / admin123    (ADMIN)');
    console.log('  trader@crypto.com       / Trader1234! (TRADER)');
    console.log('  trader@cryptotrader.dev / trader123   (TRADER)');
    console.log('─────────────────────────────────────────');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
