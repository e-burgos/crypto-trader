import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { AGENT_SEEDS } from './seed/agents';
import { AgentId, LLMProvider, UserRole } from '../generated/prisma/enums';
import { createCipheriv, randomBytes } from 'crypto';

// Inlined from src/agents/agent-presets.ts to avoid importing src/ in production seed
const PRESET_FREE: Partial<
  Record<AgentId, { provider: LLMProvider; model: string }>
> = {
  [AgentId.routing]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.orchestrator]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.synthesis]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.platform]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.operations]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.market]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.blockchain]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.risk]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
};

const BCRYPT_SALT_ROUNDS = 12;

function demoAccountSeedingAllowed(): boolean {
  // Demo credentials are readable in the repository, so production never provisions them
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.SEED_DEMO_ACCOUNTS !== 'false';
}

async function seedSuperAdmin(prisma: PrismaClient) {
  const email = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!email || !password) {
    // The Dockerfile CMD runs this seed before starting the API, so failing here
    // stops the container: an API in production nobody can sign in to is not a
    // degraded service (spec-e-burgos-008, DEC-ADMIN).
    if (isProduction) {
      throw new Error(
        'ADMIN_USERNAME and ADMIN_PASSWORD are required in production: without them no account can sign in.',
      );
    }
    console.log(
      'Super admin skipped — ADMIN_USERNAME/ADMIN_PASSWORD not set (non-production)',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email },
    // Converges on every run: rotating the password means changing the secret
    // and redeploying, the same contract as the application role in 00-init.sql.
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { email, passwordHash, role: UserRole.ADMIN, isActive: true },
  });
  console.log(`Super admin ready: ${admin.email}`);

  const otherAdmins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN, email: { not: email } },
    select: { email: true },
  });
  if (otherAdmins.length > 0) {
    // Reported, never deleted: a seed that deletes users eventually deletes the wrong one.
    console.warn(
      `WARNING: ${otherAdmins.length} other ADMIN account(s) exist and were NOT removed: ${otherAdmins
        .map((u) => u.email)
        .join(', ')}`,
    );
  }
}

async function seedDemoAccounts(prisma: PrismaClient) {
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

  console.log('─────────────────────────────────────────');
  console.log('  admin@crypto.com        / Admin1234!  (ADMIN)');
  console.log('  admin@cryptotrader.dev  / admin123    (ADMIN)');
  console.log('  trader@crypto.com       / Trader1234! (TRADER)');
  console.log('  trader@cryptotrader.dev / trader123   (TRADER)');
  console.log('─────────────────────────────────────────');
}

async function seedReferenceData(prisma: PrismaClient) {
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
      requiresApiKey: false,
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
    'altfins',
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
}

const DEMO_LLM_KEY_EMAILS = [
  'admin@crypto.com',
  'admin@cryptotrader.dev',
  'trader@crypto.com',
  'trader@cryptotrader.dev',
];

function encryptLikeTheApi(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const key = process.env.BINANCE_KEY_ENCRYPTION_KEY || '';
  if (key.length !== 32) {
    throw new Error('BINANCE_KEY_ENCRYPTION_KEY must be exactly 32 characters');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const combined = Buffer.concat([encrypted, cipher.getAuthTag()]);
  return { encrypted: combined.toString('base64'), iv: iv.toString('base64') };
}

async function seedDemoLlmCredentials(prisma: PrismaClient) {
  const { encrypted, iv } = encryptLikeTheApi(
    'sk-or-v1-demo-placeholder-not-a-real-key',
  );
  for (const email of DEMO_LLM_KEY_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    await prisma.lLMCredential.upsert({
      where: {
        userId_provider: { userId: user.id, provider: LLMProvider.OPENROUTER },
      },
      update: {},
      create: {
        userId: user.id,
        provider: LLMProvider.OPENROUTER,
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
        selectedModel: 'e2e/placeholder',
        isActive: true,
      },
    });
  }
  console.log(
    'Demo LLM credentials ready (placeholder OpenRouter key, never overwrites a real one)',
  );
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedReferenceData(prisma);
    await seedSuperAdmin(prisma);

    if (demoAccountSeedingAllowed()) {
      await seedDemoAccounts(prisma);
      await seedDemoLlmCredentials(prisma);
    } else {
      console.log(
        'Demo accounts skipped — reference data only (NODE_ENV=production or SEED_DEMO_ACCOUNTS=false)',
      );
    }

    console.log('\n✅ Seed completado!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
