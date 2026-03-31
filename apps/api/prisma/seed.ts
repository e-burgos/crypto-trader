import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Create admin user
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
    console.log(`Admin user created: ${admin.email} (${admin.id})`);

    // Create test trader
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
    console.log(`Trader user created: ${trader.email} (${trader.id})`);

    // Create sandbox trading config for trader
    await prisma.tradingConfig.upsert({
      where: {
        userId_asset_pair: {
          userId: trader.id,
          asset: 'BTC',
          pair: 'USDT',
        },
      },
      update: {},
      create: {
        userId: trader.id,
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
    console.log('Sandbox trading config created for trader (BTC/USDT)');

    console.log('\nSeed completed successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
