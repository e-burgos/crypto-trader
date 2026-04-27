import {
  HelpCircle,
  AlertTriangle,
  Sparkles,
  GitFork,
  Sliders,
  BarChart2,
  Radio,
  Cpu,
  Key,
  Zap,
  LayoutDashboard,
  Activity,
  Brain,
  Bot,
  BotMessageSquare,
  Newspaper,
  Settings,
} from 'lucide-react';
import type { DocsSidebarGroup } from '@crypto-trader/ui';

export interface DocsPageMeta {
  slug: string;
  title: string;
  description: string;
  group: string;
  icon: React.ReactNode;
  keywords: string[];
}

export const DOCS_PAGES: DocsPageMeta[] = [
  // ── Getting Started ─────────────────────────────────────────────────────────
  {
    slug: 'quickstart',
    title: 'Quickstart',
    description: 'Get up and running with CryptoTrader in minutes',
    group: 'Getting Started',
    icon: <Zap className="h-4 w-4" />,
    keywords: ['start', 'setup', 'install', 'onboarding', 'account', 'first'],
  },
  {
    slug: 'platform-behavior',
    title: 'Platform Behavior',
    description: 'Important behaviors, warnings, and how the platform works',
    group: 'Getting Started',
    icon: <AlertTriangle className="h-4 w-4" />,
    keywords: ['stop', 'behavior', 'warning', 'rate limit', 'lifecycle'],
  },
  // ── Platform pages ───────────────────────────────────────────────────────────
  {
    slug: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Portfolio performance, PnL chart, and quick navigation',
    group: 'Platform',
    icon: <LayoutDashboard className="h-4 w-4" />,
    keywords: [
      'dashboard',
      'overview',
      'pnl',
      'portfolio',
      'balance',
      'kpi',
      'chart',
    ],
  },
  {
    slug: 'agents',
    title: 'Agents',
    description: 'Meet the 7 AI agent roles powering CryptoTrader',
    group: 'Platform',
    icon: <Sparkles className="h-4 w-4" />,
    keywords: [
      'agent',
      'krypto',
      'nexus',
      'forge',
      'sigma',
      'cipher',
      'aegis',
      'multi-agent',
    ],
  },
  {
    slug: 'agent-flow',
    title: 'Agent Decision Flow',
    description: 'How the agent makes trading decisions step by step',
    group: 'Platform',
    icon: <GitFork className="h-4 w-4" />,
    keywords: [
      'decision',
      'flow',
      'cycle',
      'buy',
      'sell',
      'hold',
      'confidence',
    ],
  },
  {
    slug: 'agent-config',
    title: 'Agent Configuration',
    description:
      'Configure agent parameters, presets, and understand key concepts',
    group: 'Platform',
    icon: <Sliders className="h-4 w-4" />,
    keywords: [
      'config',
      'threshold',
      'stop loss',
      'take profit',
      'preset',
      'parameter',
      'risk',
    ],
  },
  {
    slug: 'agent-decisions',
    title: 'Agent Log',
    description:
      'Review every agent decision: what it decided, why, and with what confidence',
    group: 'Platform',
    icon: <Bot className="h-4 w-4" />,
    keywords: [
      'agent log',
      'decision',
      'buy',
      'sell',
      'hold',
      'confidence',
      'reasoning',
      'history',
    ],
  },
  {
    slug: 'trade-execution',
    title: 'Trade Execution',
    description: 'How trades are executed, buy/sell rules, and real examples',
    group: 'Platform',
    icon: <BarChart2 className="h-4 w-4" />,
    keywords: ['trade', 'execution', 'buy', 'sell', 'fee', 'order', 'pnl'],
  },
  {
    slug: 'market',
    title: 'Market & Charts',
    description: 'Live prices, OHLCV charts, and technical indicators',
    group: 'Platform',
    icon: <Activity className="h-4 w-4" />,
    keywords: [
      'market',
      'chart',
      'price',
      'ohlcv',
      'candlestick',
      'rsi',
      'macd',
      'bollinger',
      'indicator',
    ],
  },
  {
    slug: 'bot-analysis',
    title: 'Bot Analysis',
    description:
      'Combined score from technical indicators, news sentiment, and agent history',
    group: 'Platform',
    icon: <Brain className="h-4 w-4" />,
    keywords: [
      'bot analysis',
      'technical',
      'sentiment',
      'combined score',
      'bullish',
      'bearish',
      'next decision',
    ],
  },
  {
    slug: 'chat',
    title: 'Multi-Agent Chat',
    description:
      'Ask AI agents anything about the platform, market, or your trades',
    group: 'Platform',
    icon: <BotMessageSquare className="h-4 w-4" />,
    keywords: [
      'chat',
      'ask',
      'question',
      'ai',
      'multi-agent',
      'conversation',
      'nexus',
      'session',
    ],
  },
  {
    slug: 'news-feed',
    title: 'News Feed',
    description: 'Crypto news with sentiment analysis used by the AI agents',
    group: 'Platform',
    icon: <Newspaper className="h-4 w-4" />,
    keywords: [
      'news',
      'feed',
      'sentiment',
      'positive',
      'negative',
      'neutral',
      'sigma',
      'headlines',
    ],
  },
  // ── Integrations ────────────────────────────────────────────────────────────
  {
    slug: 'binance',
    title: 'Binance Integration',
    description: 'How CryptoTrader connects to Binance for trading',
    group: 'Integrations',
    icon: <BarChart2 className="h-4 w-4" />,
    keywords: [
      'binance',
      'exchange',
      'spot',
      'pair',
      'commission',
      'security',
      'api',
    ],
  },
  {
    slug: 'operation-modes',
    title: 'Operation Modes',
    description: 'Understand Sandbox, Testnet, and Live modes',
    group: 'Integrations',
    icon: <Radio className="h-4 w-4" />,
    keywords: ['sandbox', 'testnet', 'live', 'mode', 'simulation', 'real'],
  },
  {
    slug: 'llm-providers',
    title: 'LLM Providers',
    description: 'AI providers, model recommendations, and smart presets',
    group: 'Integrations',
    icon: <Cpu className="h-4 w-4" />,
    keywords: [
      'llm',
      'openrouter',
      'claude',
      'openai',
      'groq',
      'model',
      'provider',
      'preset',
    ],
  },
  {
    slug: 'api-keys',
    title: 'API Keys',
    description: 'How to set up API keys for LLM providers and Binance',
    group: 'Integrations',
    icon: <Key className="h-4 w-4" />,
    keywords: [
      'api',
      'key',
      'openrouter',
      'binance',
      'claude',
      'openai',
      'groq',
      'setup',
    ],
  },
  // ── Configuration ────────────────────────────────────────────────────────────
  {
    slug: 'settings-agents',
    title: 'Agent Model Settings',
    description:
      'Configure which LLM model each agent uses, presets, and validation',
    group: 'Configuration',
    icon: <Settings className="h-4 w-4" />,
    keywords: [
      'settings',
      'agents',
      'model',
      'preset',
      'validated',
      'openrouter',
      'per-agent',
    ],
  },
  // ── Support ──────────────────────────────────────────────────────────────────
  {
    slug: 'faq',
    title: 'FAQ',
    description: 'Frequently asked questions about the platform',
    group: 'Support',
    icon: <HelpCircle className="h-4 w-4" />,
    keywords: ['faq', 'question', 'help', 'support', 'common'],
  },
];

/** Build sidebar groups from page metadata */
export function buildSidebarGroups(pages: DocsPageMeta[]): DocsSidebarGroup[] {
  const groupMap = new Map<string, DocsPageMeta[]>();
  pages.forEach((p) => {
    const existing = groupMap.get(p.group) ?? [];
    existing.push(p);
    groupMap.set(p.group, existing);
  });

  return Array.from(groupMap.entries()).map(([label, groupPages]) => ({
    label,
    links: groupPages.map((p) => ({
      slug: p.slug,
      label: p.title,
      icon: p.icon,
    })),
  }));
}

/** Get previous and next pages for pagination */
export function getPageNavigation(currentSlug: string) {
  const idx = DOCS_PAGES.findIndex((p) => p.slug === currentSlug);
  return {
    prev: idx > 0 ? DOCS_PAGES[idx - 1] : undefined,
    next: idx < DOCS_PAGES.length - 1 ? DOCS_PAGES[idx + 1] : undefined,
  };
}

/** Get page metadata by slug */
export function getPageMeta(slug: string) {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

/** Map from slug to its i18n title key */
export const SLUG_TITLE_KEY_MAP: Record<string, string> = {
  quickstart: 'docs.quickstart.title',
  'platform-behavior': 'docs.platformBehavior.title',
  dashboard: 'docs.dashboard.title',
  agents: 'docs.agents.title',
  'agent-flow': 'docs.agentFlow.title',
  'agent-config': 'docs.agentConfig.title',
  'agent-decisions': 'docs.agentDecisions.title',
  'trade-execution': 'docs.tradeExecution.title',
  market: 'docs.market.title',
  'bot-analysis': 'docs.botAnalysis.title',
  chat: 'docs.chat.title',
  'news-feed': 'docs.newsFeed.title',
  binance: 'docs.binance.title',
  'operation-modes': 'docs.operationModes.title',
  'llm-providers': 'docs.llmProviders.title',
  'api-keys': 'docs.apiKeys.title',
  'settings-agents': 'docs.settingsAgents.title',
  faq: 'docs.faq.title',
};
