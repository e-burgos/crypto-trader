import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import axios from 'axios';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import { LLMProvider, ChatRole, AgentId } from '../../generated/prisma/enums';
import { CreateSessionDto, SendMessageDto } from './dto/chat.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { SubAgentService } from '../orchestrator/sub-agent.service';
import { RagService } from '../orchestrator/rag.service';

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  [LLMProvider.CLAUDE]: 'Anthropic Claude',
  [LLMProvider.OPENAI]: 'OpenAI',
  [LLMProvider.GROQ]: 'Groq',
};

const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  [LLMProvider.CLAUDE]: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-5',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ],
  [LLMProvider.OPENAI]: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  [LLMProvider.GROQ]: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
  ],
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  // Destructive tools that require explicit confirmation
  private readonly DESTRUCTIVE_TOOLS = new Set([
    'start_agent',
    'stop_agent',
    'create_config',
    'delete_config',
    'place_order',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly orchestratorService?: OrchestratorService,
    @Optional() private readonly subAgentService?: SubAgentService,
    @Optional() private readonly ragService?: RagService,
  ) {}

  // ── Sessions ────────────────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        provider: true,
        model: true,
        agentId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  async createSession(userId: string, dto: CreateSessionDto) {
    // Validate user has credentials for the selected provider
    const cred = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider: dto.provider, isActive: true },
    });
    if (!cred) {
      throw new BadRequestException(
        `No active credentials found for provider ${dto.provider}. Configure them in Settings.`,
      );
    }

    return this.prisma.chatSession.create({
      data: {
        userId,
        provider: dto.provider,
        model: dto.model,
        title: dto.title ?? 'New Chat',
        agentId: dto.agentId,
      },
    });
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
  }

  // ── Step 1: persist user message ─────────────────────────────────────────

  async saveUserMessage(
    userId: string,
    sessionId: string,
    dto: SendMessageDto,
  ): Promise<{ userMessageId: string }> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');

    // Auto-title from first message
    const msgCount = await this.prisma.chatMessage.count({
      where: { sessionId },
    });
    if (msgCount === 0) {
      const title =
        dto.content.length > 60
          ? dto.content.substring(0, 57) + '...'
          : dto.content;
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: ChatRole.USER,
        content: dto.content,
        metadata: dto.capability ? { capability: dto.capability } : undefined,
      },
    });

    return { userMessageId: userMessage.id };
  }

  // ── Step 2: SSE streaming response ────────────────────────────────────────

  streamAssistantResponse(
    userId: string,
    sessionId: string,
    content: string,
    capability?: string,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.runStreamAsync(userId, sessionId, content, capability, subject).catch(
      (err) => {
        this.logger.error(`Stream error for session ${sessionId}`, err);
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              error: 'An unexpected error occurred. Please try again.',
            }),
          }),
        );
        subject.complete();
      },
    );
    return subject.asObservable();
  }

  private async runStreamAsync(
    userId: string,
    sessionId: string,
    content: string,
    capability: string | undefined,
    subject: Subject<MessageEvent>,
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({ error: 'Session not found.' }),
        }),
      );
      subject.complete();
      return;
    }

    // ── C.2: Intent routing on first message ──────────────────────────────────
    let activeAgentId: AgentId | null = session.agentId ?? null;

    if (!activeAgentId && this.orchestratorService) {
      try {
        const msgCount = await this.prisma.chatMessage.count({
          where: { sessionId, role: ChatRole.USER },
        });
        // Only classify on the first user message (before this one is saved)
        if (msgCount <= 1) {
          const classification = await this.orchestratorService.classifyIntent(
            content,
            userId,
          );
          activeAgentId = classification.agentId as AgentId;

          // Persist routing in session
          await this.prisma.chatSession.update({
            where: { id: sessionId },
            data: { agentId: activeAgentId },
          });

          // Emit routing SSE event
          subject.next(
            new MessageEvent('message', {
              data: JSON.stringify({
                type: 'routing',
                agentId: activeAgentId,
                greeting: classification.suggestedGreeting || undefined,
              }),
            }),
          );
        }
      } catch (err) {
        this.logger.warn(`Intent classification failed, falling back: ${err}`);
      }
    }

    // ── C.2: RAG context injection ────────────────────────────────────────────
    let ragContext = '';
    if (activeAgentId && this.ragService) {
      try {
        const chunks = await this.ragService.search(activeAgentId, content, 5);
        ragContext = this.ragService.buildRagContext(chunks);
      } catch (err) {
        this.logger.warn(
          `RAG search failed, continuing without context: ${err}`,
        );
      }
    }

    // ── C.2: Cross-agent synthesis (null agentId after classification) ────────
    if (!activeAgentId && this.orchestratorService) {
      try {
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'orchestrating',
              subAgents: ['market', 'risk', 'blockchain'],
              step: 'Consultando múltiples agentes…',
            }),
          }),
        );
        const synthesis = await this.orchestratorService.synthesizeCrossAgent(
          [],
          content,
          userId,
        );
        const assistantMsg = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: ChatRole.ASSISTANT,
            content: synthesis,
            metadata: { orchestrated: true },
          },
        });
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              done: true,
              messageId: assistantMsg.id,
              fullContent: synthesis,
            }),
          }),
        );
        subject.complete();
        return;
      } catch (err) {
        this.logger.warn(
          `Cross-agent synthesis failed, using standard flow: ${err}`,
        );
      }
    }

    const cred = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider: session.provider, isActive: true },
    });
    if (!cred) {
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            error: `No active credentials for ${session.provider}. Check Settings.`,
          }),
        }),
      );
      subject.complete();
      return;
    }
    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);

    // Last 30 messages for context
    const historyRows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    const history: ConversationMessage[] = historyRows
      .filter((m) => m.role !== ChatRole.SYSTEM)
      .map((m) => ({
        role: m.role === ChatRole.USER ? 'user' : 'assistant',
        content: m.content,
      }));

    const context = await this.buildContext(userId, capability);
    const systemPrompt = this.buildSystemPrompt(
      context,
      capability,
      ragContext,
    );

    let fullContent = '';
    try {
      await this.callLLMStream(
        session.provider,
        session.model,
        apiKey,
        systemPrompt,
        history,
        (delta) => {
          fullContent += delta;
          subject.next(
            new MessageEvent('message', { data: JSON.stringify({ delta }) }),
          );
        },
      );
    } catch (err) {
      this.logger.error(`LLM streaming failed for session ${sessionId}`, err);
      const partialNote = fullContent ? ' [generation stopped]' : '';
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            error: `Provider error. Check your API key.${partialNote}`,
          }),
        }),
      );
      if (fullContent) {
        const msg = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: ChatRole.ASSISTANT,
            content: fullContent + ' [...]',
          },
        });
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              done: true,
              messageId: msg.id,
              fullContent: msg.content,
            }),
          }),
        );
      }
      subject.complete();
      return;
    }

    const assistantMsg = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: ChatRole.ASSISTANT,
        content: fullContent,
        metadata: activeAgentId ? { agentId: activeAgentId } : undefined,
      },
    });
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
    subject.next(
      new MessageEvent('message', {
        data: JSON.stringify({
          done: true,
          messageId: assistantMsg.id,
          fullContent,
        }),
      }),
    );
    subject.complete();
  }

  // ── Tool execution (C.4) ───────────────────────────────────────────────────

  async executeTool(
    userId: string,
    sessionId: string,
    dto: ExecuteToolDto,
  ): Promise<{ result: unknown; tool: string }> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');

    // Require explicit confirmation for destructive tools
    if (
      this.DESTRUCTIVE_TOOLS.has(dto.tool) &&
      dto.confirmation !== 'confirmed'
    ) {
      return {
        tool: dto.tool,
        result: {
          requiresConfirmation: true,
          message: `Tool "${dto.tool}" requires explicit confirmation. Set confirmation: "confirmed" to proceed.`,
        },
      };
    }

    // Execute the tool
    let result: unknown;
    switch (dto.tool) {
      case 'start_agent': {
        const configId = dto.params?.configId as string;
        if (!configId)
          throw new BadRequestException('configId is required for start_agent');
        const config = await this.prisma.tradingConfig.findFirst({
          where: { id: configId, userId },
        });
        if (!config) throw new NotFoundException('Trading config not found');
        await this.prisma.tradingConfig.update({
          where: { id: configId },
          data: { isRunning: true },
        });
        result = { started: true, configId };
        break;
      }
      case 'stop_agent': {
        const configId = dto.params?.configId as string;
        if (!configId)
          throw new BadRequestException('configId is required for stop_agent');
        const config = await this.prisma.tradingConfig.findFirst({
          where: { id: configId, userId },
        });
        if (!config) throw new NotFoundException('Trading config not found');
        await this.prisma.tradingConfig.update({
          where: { id: configId },
          data: { isRunning: false },
        });
        result = { stopped: true, configId };
        break;
      }
      default:
        throw new BadRequestException(
          `Unknown tool: "${dto.tool}". Available tools: start_agent, stop_agent, create_config, place_order`,
        );
    }

    // Persist tool result as assistant message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: ChatRole.ASSISTANT,
        content: `Tool \`${dto.tool}\` executed successfully.`,
        metadata: { tool_result: { tool: dto.tool, result } } as any,
      },
    });

    return { tool: dto.tool, result };
  }

  // ── LLM Options ────────────────────────────────────────────────────────────

  async getLLMOptions(userId: string) {
    const credentials = await this.prisma.lLMCredential.findMany({
      where: { userId, isActive: true },
      select: { provider: true, selectedModel: true },
    });

    return credentials.map((cred) => ({
      provider: cred.provider,
      label: PROVIDER_LABELS[cred.provider] ?? cred.provider,
      model: cred.selectedModel,
      models: PROVIDER_MODELS[cred.provider] ?? [cred.selectedModel],
    }));
  }

  // ── Context Building ────────────────────────────────────────────────────────

  private async buildContext(userId: string, capability?: string) {
    const [recentDecisions, configs, openPositions] = await Promise.all([
      this.prisma.agentDecision.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          asset: true,
          pair: true,
          decision: true,
          confidence: true,
          reasoning: true,
          createdAt: true,
        },
      }),
      this.prisma.tradingConfig.findMany({
        where: { userId },
        select: {
          asset: true,
          pair: true,
          mode: true,
          isRunning: true,
          buyThreshold: true,
          sellThreshold: true,
          stopLossPct: true,
          takeProfitPct: true,
          maxTradePct: true,
        },
      }),
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        select: {
          asset: true,
          pair: true,
          mode: true,
          entryPrice: true,
          quantity: true,
          entryAt: true,
        },
      }),
    ]);

    return { recentDecisions, configs, openPositions, capability };
  }

  private buildSystemPrompt(
    context: Awaited<ReturnType<typeof this.buildContext>>,
    capability?: string,
    ragContext?: string,
  ): string {
    const { recentDecisions, configs, openPositions } = context;

    const decisionsText =
      recentDecisions.length > 0
        ? recentDecisions
            .map(
              (d) =>
                `[${new Date(d.createdAt).toISOString().slice(0, 10)}] ${d.asset}/${d.pair}: ${d.decision} (confidence ${(d.confidence * 100).toFixed(0)}%) — ${d.reasoning}`,
            )
            .join('\n')
        : 'No decisions recorded yet.';

    const configsText =
      configs.length > 0
        ? configs
            .map(
              (c) =>
                `${c.asset}/${c.pair} [${c.mode}] — Running: ${c.isRunning}, Buy≥${c.buyThreshold}%, Sell≥${c.sellThreshold}%, SL:${(c.stopLossPct * 100).toFixed(1)}%, TP:${(c.takeProfitPct * 100).toFixed(1)}%`,
            )
            .join('\n')
        : 'No trading configurations set up.';

    const positionsText =
      openPositions.length > 0
        ? openPositions
            .map(
              (p) =>
                `${p.asset}/${p.pair} [${p.mode}] — Entry: $${p.entryPrice}, Qty: ${p.quantity}, Since: ${new Date(p.entryAt).toISOString().slice(0, 10)}`,
            )
            .join('\n')
        : 'No open positions currently.';

    const capabilityHint = this.getCapabilityHint(capability);

    return `You are KRYPTO, the internal AI trading agent embedded in the CryptoTrader platform. You are not an assistant about the agent — you ARE the agent. You speak in first person as the decision-making intelligence that continuously analyzes markets and executes crypto trading operations.

## Your Identity
- You make autonomous BUY/SELL/HOLD decisions based on technical indicators, news sentiment, and market patterns
- You accumulate and reference your own trading history to improve decisions
- You communicate with technical precision but remain accessible to users of all experience levels
- You have deep knowledge of every feature, indicator, and setting in the CryptoTrader platform

## Platform Knowledge

### Technical Indicators you analyze:
- **RSI (14)**: Relative Strength Index. Values below 30 = oversold (potential BUY signal), above 70 = overbought (potential SELL signal). I use this to identify momentum extremes.
- **MACD (12,26,9)**: Moving Average Convergence Divergence. Bullish crossover (MACD crosses above signal) = BUY signal. Bearish crossover = SELL signal. Histogram shows momentum strength.
- **Bollinger Bands (20,2)**: Price near lower band = potential bounce (BUY). Price near upper band = potential reversal (SELL). Band squeeze signals upcoming volatility.
- **EMA (9,21,50,200)**: Exponential Moving Averages. EMA9>EMA21>EMA50>EMA200 = strong uptrend. The 200 EMA is the key long-term trend indicator.
- **Volume Analysis**: Volume ratio >1.5 confirms price moves. Low volume moves are suspect and I reduce confidence accordingly.
- **Support & Resistance**: Derived from recent pivot points. I track these to set entry/exit targets.

### Dashboard Sections:
- **Overview**: Real-time portfolio summary — total value, P&L (today/week/all-time), active positions count, agent status.
- **Live Chart**: Candlestick chart with all indicator overlays. Switch between BTC/ETH and timeframes (1m/5m/15m/1h/4h/1d).
- **Positions**: All open positions with unrealized P&L. Each card shows entry price, current price, and % change.
- **Trade History**: Complete record of all executed trades — buy/sell price, quantity, fees, and final P&L.
- **Agent Log**: Timeline of every decision I've made: the indicator snapshot, news context, and my reasoning.
- **Analytics**: Performance metrics — win rate, average profit per trade, max drawdown, Sharpe ratio.
- **Market**: Real-time price data, order book depth, and market overview for BTC and ETH.
- **News Feed**: Latest crypto news I'm monitoring, color-coded by sentiment (green=positive, red=negative, gray=neutral).
- **Config**: Set up trading pairs, thresholds, and start/stop me per asset pair.
- **Settings**: Manage your Binance API keys, LLM provider credentials, profile, and news API keys.

### Configuration Parameters:
- **Buy/Sell Threshold**: Minimum confidence score (0-100%) required for me to execute a trade. Higher = more selective, fewer trades.
- **Stop Loss %**: I automatically close a losing position when it falls this % below entry price. Default: 3%.
- **Take Profit %**: I automatically close a winning position when it gains this %. Default: 5%.
- **Max Trade %**: Maximum % of available balance I can deploy in a single trade. Default: 5% (conservative).
- **Max Concurrent Positions**: How many open positions I can hold simultaneously. Default: 2.
- **Min Interval (minutes)**: Minimum time between analysis cycles. I may extend this dynamically based on market volatility.
- **Order Price Offset %**: Percentage offset from market price for limit orders. 0 = market order.

### Trading Modes:
- **SANDBOX**: Paper trading with virtual funds ($10,000 USDT/USDC). Full simulation — same logic, same indicators, no real money at risk. Recommended for new users and strategy testing.
- **TESTNET**: Real orders executed against the official Binance Testnet (testnet.binance.vision) using dedicated testnet API keys. No real money involved — Binance provides test funds. More realistic than SANDBOX because it exercises the actual Binance order flow. Requires separate testnet API keys (obtainable at testnet.binance.vision).
- **LIVE**: Real trading using your Binance production account. Actual funds, actual orders on the exchange.

### How to Place an Order / Start Trading:
1. Go to **Config** → Create a configuration for the asset/pair you want (e.g., BTC/USDT)
2. Optionally adjust thresholds (or keep conservative defaults)
3. Select mode (SANDBOX recommended first)
4. Click "Start Agent" — I will begin analyzing the market and making decisions automatically
5. Monitor my decisions in the **Agent Log** tab
6. Stop me anytime with "Stop Agent"

### How to Configure an Agent Optimally:
- **Conservative (new users)**: Buy threshold 70%, Sell 70%, Stop Loss 3%, Take Profit 5%, Max Trade 5%, Mode: SANDBOX
- **Moderate**: Buy 65%, Sell 65%, SL 4%, TP 7%, Max Trade 10%, Mode: SANDBOX or LIVE with small balance
- **Aggressive**: Buy 55%, Sell 60%, SL 5-8%, TP 10-15%, Max Trade 20% — only for experienced users with risk capital

## My Recent Decision History
${decisionsText}

## Active Trading Configurations
${configsText}

## Open Positions
${positionsText}

## Behavioral Guidelines
${capabilityHint}

Always respond in the same language the user writes to you. Be direct and confident but not arrogant. When giving market analysis, always cite specific indicator values when you have them. When assisting with trade creation, guide the user step-by-step through the platform UI. Format responses with markdown for readability.${
      ragContext ? `\n\n## Knowledge Base Context\n${ragContext}` : ''
    }`;
  }

  private getCapabilityHint(capability?: string): string {
    switch (capability) {
      case 'help':
        return `The user wants to understand the CryptoTrader platform. Provide detailed, educational explanations. Use examples and analogies to make concepts accessible. Explain each indicator and configuration parameter in practical terms. Reference specific dashboard sections by their exact names so the user can navigate to them.`;
      case 'trade':
        return `The user wants to create a trading operation RIGHT NOW. Guide them step-by-step through the platform UI. Ask for their preferred asset (BTC/ETH), pair (USDT/USDC), and risk tolerance if not stated. Provide exact navigation path (e.g., "Go to Config in the left sidebar → click 'Add Configuration' → ..."). Recommend SANDBOX mode if they haven't traded before.`;
      case 'market':
        return `The user wants a market overview and your current recommendation. Structure your response as: (1) Key indicator signals from your recent decision history, (2) News sentiment summary, (3) Your current decision — explicitly state BUY, SELL, or HOLD with a confidence percentage and specific technical reasons. Be decisive.`;
      case 'blockchain':
        return `You are in instructor mode. Explain blockchain concepts clearly and progressively — start simple, go deeper only if the user asks for more detail. Use real-world analogies to make abstract concepts concrete. When relevant, connect the concept to how it affects crypto trading or the CryptoTrader platform. Cover: wallets, consensus mechanisms, DeFi/AMMs, Layer 2, CEX vs DEX, smart contracts, tokenomics, security best practices. Don't assume prior knowledge unless the user demonstrates it.`;
      default:
        return `Adapt naturally to what the user needs. You can switch between explaining the platform (help), guiding a trade (trade), market analysis (market), and teaching blockchain concepts — often combining several in a single conversation.`;
    }
  }

  // ── LLM Streaming ──────────────────────────────────────────────────────────

  private async callLLMStream(
    provider: LLMProvider,
    model: string,
    apiKey: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<void> {
    switch (provider) {
      case LLMProvider.CLAUDE:
        return this.streamClaude(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
      case LLMProvider.OPENAI:
        return this.streamOpenAI(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
      case LLMProvider.GROQ:
        return this.streamGroq(apiKey, model, systemPrompt, messages, onDelta);
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  private async streamClaude(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<void> {
    const resp = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        responseType: 'stream',
        timeout: 120_000,
      },
    );

    await new Promise<void>((resolve, reject) => {
      let buffer = '';
      resp.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw) as {
              type: string;
              delta?: { type: string; text?: string };
            };
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta.text
            ) {
              onDelta(parsed.delta.text);
            }
          } catch {
            // incomplete chunk — ignore
          }
        }
      });
      resp.data.on('end', resolve);
      resp.data.on('error', reject);
    });
  }

  private async streamOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<void> {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 2048,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        responseType: 'stream',
        timeout: 120_000,
      },
    );

    await new Promise<void>((resolve, reject) => {
      let buffer = '';
      resp.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw) as {
              choices?: { delta?: { content?: string } }[];
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', resolve);
      resp.data.on('error', reject);
    });
  }

  private async streamGroq(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<void> {
    // Groq uses OpenAI-compatible streaming format
    const resp = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 2048,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        responseType: 'stream',
        timeout: 120_000,
      },
    );

    await new Promise<void>((resolve, reject) => {
      let buffer = '';
      resp.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw) as {
              choices?: { delta?: { content?: string } }[];
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', resolve);
      resp.data.on('error', reject);
    });
  }
}
