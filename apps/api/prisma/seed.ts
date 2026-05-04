import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { AGENT_SEEDS } from './seed/agents';
import { PRESET_FREE } from '../src/agents/agent-presets';
import { AgentId, LLMProvider } from '../generated/prisma/enums';

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
      const existingConfig = await prisma.tradingConfig.findFirst({
        where: { userId: t.id, asset: 'BTC', pair: 'USDT' },
      });
      if (!existingConfig) {
        await prisma.tradingConfig.create({
          data: {
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
      } else {
        console.log(
          `Sandbox trading config already exists for ${t.email} (BTC/USDT)`,
        );
      }
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

    // ── AdminAgentConfig: seed con preset gratuito (Spec 36) ─────────────────
    // Solo se aplica en create — no sobreescribe customizaciones de admin.
    for (const [agentIdStr, entry] of Object.entries(PRESET_FREE)) {
      const agentId = agentIdStr as AgentId;
      if (agentId === AgentId.orchestrator) continue;
      const existing = await prisma.adminAgentConfig.findUnique({
        where: { agentId },
      });
      if (!existing) {
        await prisma.adminAgentConfig.create({
          data: {
            agentId,
            provider: entry.provider as LLMProvider,
            model: entry.model,
            updatedBy: 'seed',
          },
        });
        console.log(`AdminAgentConfig seeded: ${agentId} → ${entry.model}`);
      } else {
        console.log(`AdminAgentConfig already set: ${agentId} (skipped)`);
      }
    }

    // ── PlatformLLMProvider: seed all providers as active (Spec 38) ──────────
    const allProviders = Object.values(LLMProvider);
    for (const provider of allProviders) {
      await prisma.platformLLMProvider.upsert({
        where: { provider },
        update: {},
        create: { provider, isActive: true },
      });
    }
    console.log(
      `PlatformLLMProvider seeded: ${allProviders.length} providers (all active)`,
    );

    // ── Spec 40: Data Source Configs ─────────────────────────────────────────
    const dataSources = [
      {
        name: 'alternative_me',
        displayName: 'Alternative.me — Fear & Greed Index',
        category: 'SENTIMENT' as const,
        targetAgents: ['market', 'orchestrator'],
        requiresApiKey: false,
        baseUrl: 'https://api.alternative.me',
        rateLimitPerMin: 100,
        pollingIntervalMs: 1_800_000, // 30min
        monthlyCostUsd: 0,
      },
      {
        name: 'coinalyze',
        displayName: 'Coinalyze — Derivados Agregados',
        category: 'DERIVATIVES' as const,
        targetAgents: ['risk', 'market'],
        requiresApiKey: true,
        baseUrl: 'https://api.coinalyze.net',
        rateLimitPerMin: 40,
        pollingIntervalMs: 900_000, // 15min
        monthlyCostUsd: 0,
      },
      {
        name: 'defillama',
        displayName: 'DefiLlama — TVL + Stablecoins + Fees',
        category: 'DEFI_ONCHAIN' as const,
        targetAgents: ['risk', 'market'],
        requiresApiKey: false,
        baseUrl: 'https://api.llama.fi',
        rateLimitPerMin: 60,
        pollingIntervalMs: 3_600_000, // 1h
        monthlyCostUsd: 0,
      },
      {
        name: 'finnhub',
        displayName: 'Finnhub — Noticias + Sentimiento NLP',
        category: 'NEWS' as const,
        targetAgents: ['market', 'blockchain'],
        requiresApiKey: true,
        baseUrl: 'https://finnhub.io/api/v1',
        rateLimitPerMin: 60,
        pollingIntervalMs: 600_000, // 10min
        monthlyCostUsd: 0,
      },
      {
        name: 'coingecko',
        displayName: 'CoinGecko — Market Data Global',
        category: 'MARKET_DATA' as const,
        targetAgents: ['market', 'orchestrator'],
        requiresApiKey: false,
        baseUrl: 'https://api.coingecko.com/api/v3',
        rateLimitPerMin: 10,
        pollingIntervalMs: 1_800_000, // 30min
        monthlyCostUsd: 0,
      },
      {
        name: 'polymarket',
        displayName: 'Polymarket — Prediction Markets',
        category: 'PREDICTION' as const,
        targetAgents: ['market', 'blockchain'],
        requiresApiKey: false,
        baseUrl: 'https://gamma-api.polymarket.com',
        rateLimitPerMin: 60,
        pollingIntervalMs: 3_600_000, // 1h
        monthlyCostUsd: 0,
      },
      {
        name: 'messari',
        displayName: 'Messari — Token Unlocks',
        category: 'TOKEN_UNLOCKS' as const,
        targetAgents: ['risk', 'blockchain'],
        requiresApiKey: false,
        baseUrl: 'https://api.messari.io',
        rateLimitPerMin: 20,
        pollingIntervalMs: 21_600_000, // 6h
        monthlyCostUsd: 0,
      },
      {
        name: 'altfins',
        displayName: 'altFINS — TA Pre-calculado + Señales',
        category: 'TECHNICAL' as const,
        targetAgents: ['market', 'orchestrator'],
        requiresApiKey: true,
        baseUrl: 'https://api.altfins.com',
        rateLimitPerMin: 30,
        pollingIntervalMs: 1_800_000, // 30min
        monthlyCostUsd: 0,
      },
    ];

    // Activate sources that work without an API key + popular free-tier sources
    const activeSources = new Set([
      'alternative_me',
      'defillama',
      'polymarket',
      'coingecko',
      'messari',
    ]);

    for (const ds of dataSources) {
      await prisma.dataSourceConfig.upsert({
        where: { name: ds.name },
        update: {
          displayName: ds.displayName,
          category: ds.category,
          targetAgents: ds.targetAgents,
          requiresApiKey: ds.requiresApiKey,
          baseUrl: ds.baseUrl,
          rateLimitPerMin: ds.rateLimitPerMin,
          pollingIntervalMs: ds.pollingIntervalMs,
          monthlyCostUsd: ds.monthlyCostUsd,
        },
        create: {
          ...ds,
          isActive: activeSources.has(ds.name),
        },
      });
    }
    console.log(
      `DataSourceConfig seeded: ${dataSources.length} sources (${activeSources.size} active)`,
    );

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
