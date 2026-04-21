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
import { recordCall } from '../llm/provider-health.service';
import {
  LLMProvider,
  ChatRole,
  AgentId,
  LLMSource,
} from '../../generated/prisma/enums';
import { CreateSessionDto, SendMessageDto } from './dto/chat.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { SubAgentService } from '../orchestrator/sub-agent.service';
import { RagService } from '../orchestrator/rag.service';
import { LLMModelsService } from '../llm/llm-models.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  [LLMProvider.CLAUDE]: 'Anthropic Claude',
  [LLMProvider.OPENAI]: 'OpenAI',
  [LLMProvider.GROQ]: 'Groq',
  [LLMProvider.GEMINI]: 'Google Gemini',
  [LLMProvider.MISTRAL]: 'Mistral AI',
  [LLMProvider.TOGETHER]: 'Together AI',
  [LLMProvider.OPENROUTER]: 'OpenRouter',
};

const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  [LLMProvider.CLAUDE]: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-haiku-4-5-20251001',
  ],
  [LLMProvider.OPENAI]: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
  [LLMProvider.GROQ]: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
  ],
  [LLMProvider.GEMINI]: [
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  [LLMProvider.MISTRAL]: [
    'mistral-small-latest',
    'mistral-medium-latest',
    'mistral-large-latest',
  ],
  [LLMProvider.TOGETHER]: [
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen3-235B-A22B-fp8',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ],
  [LLMProvider.OPENROUTER]: [
    // Top Paid
    'anthropic/claude-sonnet-4.6',
    'google/gemini-3-flash-preview',
    'anthropic/claude-opus-4.6',
    'deepseek/deepseek-v3.2',
    'google/gemini-2.5-flash-lite',
    // Top Free
    'openrouter/elephant-alpha',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
  ],
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
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
    @Optional() private readonly llmModelsService?: LLMModelsService,
    @Optional() private readonly llmUsageService?: LLMUsageService,
    @Optional()
    private readonly agentConfigResolver?: AgentConfigResolverService,
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

  async updateSession(
    userId: string,
    sessionId: string,
    data: { provider?: LLMProvider; model?: string },
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        ...(data.provider ? { provider: data.provider } : {}),
        ...(data.model ? { model: data.model } : {}),
        updatedAt: new Date(),
      },
    });
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
    locale?: string,
    agentOverride?: string,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.runStreamAsync(
      userId,
      sessionId,
      content,
      capability,
      subject,
      locale,
      agentOverride,
    ).catch((err) => {
      this.logger.error(`Stream error for session ${sessionId}`, err);
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            error: 'An unexpected error occurred. Please try again.',
          }),
        }),
      );
      subject.complete();
    });
    return subject.asObservable();
  }

  private async runStreamAsync(
    userId: string,
    sessionId: string,
    content: string,
    capability: string | undefined,
    subject: Subject<MessageEvent>,
    locale?: string,
    agentOverride?: string,
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

    // ── C.2: Intent routing ──────────────────────────────────────────────────
    // Priority: user-selected agent > transfer intent > session persisted > auto-classification
    const validAgents: AgentId[] = [
      AgentId.platform,
      AgentId.operations,
      AgentId.market,
      AgentId.blockchain,
      AgentId.risk,
    ];
    let activeAgentId: AgentId | null = session.agentId ?? null;

    // User explicitly selected an agent in the UI dropdown
    if (
      agentOverride &&
      validAgents.includes(agentOverride as AgentId) &&
      agentOverride !== activeAgentId
    ) {
      activeAgentId = agentOverride as AgentId;
      this.logger.log(`[Chat] User override → agent=${activeAgentId}`);
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { agentId: activeAgentId },
      });
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'routing',
            agentId: activeAgentId,
          }),
        }),
      );
    }

    // Detect transfer intent from message text (user mentions agent names)
    if (!agentOverride && activeAgentId) {
      const transferTarget = this.detectTransferIntent(content);
      if (transferTarget && transferTarget !== activeAgentId) {
        this.logger.log(
          `[Chat] Transfer intent detected: ${activeAgentId} → ${transferTarget}`,
        );
        activeAgentId = transferTarget;
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { agentId: activeAgentId },
        });
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'routing',
              agentId: activeAgentId,
            }),
          }),
        );
      }
    }

    // Auto-classify if no agent yet
    if (!activeAgentId && this.orchestratorService) {
      try {
        this.logger.log(
          `[Chat] Classifying intent for session ${sessionId}: "${content.slice(0, 80)}"`,
        );
        const classification = await this.orchestratorService.classifyIntent(
          content,
          userId,
        );
        activeAgentId = classification.agentId as AgentId;
        this.logger.log(
          `[Chat] Classified → agent=${activeAgentId} (confidence=${classification.confidence})`,
        );

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
      } catch (err) {
        this.logger.warn(`Intent classification failed, falling back: ${err}`);
        // Assign a sensible default so we don't fall through to cross-agent
        activeAgentId = AgentId.platform;
        this.logger.log(
          `[Chat] Fallback → agent=${activeAgentId} (classification failed)`,
        );
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { agentId: activeAgentId },
        });
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'routing',
              agentId: activeAgentId,
            }),
          }),
        );
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
          locale,
        );
        const assistantMsg = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: ChatRole.ASSISTANT,
            content: synthesis,
            generatedBy: 'orchestrator:cross-agent',
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

    // ── E.5: Resolve LLM via AgentConfigResolver per active agent ─────────────
    const agentIdForLLM = activeAgentId ?? AgentId.platform;
    let effectiveProvider: LLMProvider;
    let effectiveModel: string;

    if (this.agentConfigResolver) {
      try {
        const resolved = await this.agentConfigResolver.resolveConfig(
          agentIdForLLM,
          userId,
        );
        effectiveProvider = resolved.provider;
        effectiveModel = resolved.model;
      } catch (err) {
        this.logger.warn(
          `AgentConfigResolver failed for chat, falling back to session/credential: ${err}`,
        );
        // Fallback: use session provider or first active credential
        const fallbackCred = await this.prisma.lLMCredential.findFirst({
          where: { userId, isActive: true },
        });
        if (!fallbackCred) {
          subject.next(
            new MessageEvent('message', {
              data: JSON.stringify({
                error: 'No active AI provider configured. Check Settings.',
              }),
            }),
          );
          subject.complete();
          return;
        }
        effectiveProvider = fallbackCred.provider as LLMProvider;
        effectiveModel =
          fallbackCred.selectedModel ?? 'anthropic/claude-sonnet-4.6';
      }
    } else {
      // No AgentConfigResolver available — fallback to first active credential
      const fallbackCred = await this.prisma.lLMCredential.findFirst({
        where: { userId, isActive: true },
      });
      if (!fallbackCred) {
        subject.next(
          new MessageEvent('message', {
            data: JSON.stringify({
              error: 'No active AI provider configured. Check Settings.',
            }),
          }),
        );
        subject.complete();
        return;
      }
      effectiveProvider = fallbackCred.provider as LLMProvider;
      effectiveModel =
        fallbackCred.selectedModel ?? 'anthropic/claude-sonnet-4.6';
    }

    const generatedBy = `${effectiveProvider}:${effectiveModel}`;

    // Update session with resolved provider/model (for display)
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { provider: effectiveProvider, model: effectiveModel },
    });

    const cred = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider: effectiveProvider, isActive: true },
    });
    if (!cred) {
      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            error: `No active credentials for ${effectiveProvider}. Check Settings.`,
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
      locale,
    );

    let fullContent = '';
    try {
      const streamUsage = await this.callLLMStream(
        effectiveProvider,
        effectiveModel,
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

      // Log usage asynchronously (fire-and-forget)
      recordCall(userId, effectiveProvider, true);
      if (
        this.llmUsageService &&
        (streamUsage.inputTokens > 0 || streamUsage.outputTokens > 0)
      ) {
        this.llmUsageService
          .log({
            userId,
            provider: effectiveProvider,
            model: effectiveModel,
            usage: streamUsage,
            source: LLMSource.CHAT,
          })
          .catch((err) =>
            this.logger.warn(
              `Chat usage log failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
    } catch (err) {
      this.logger.error(`LLM streaming failed for session ${sessionId}`, err);
      recordCall(
        userId,
        effectiveProvider,
        false,
        err instanceof Error ? err.message : String(err),
      );
      const partialNote = fullContent ? ' [generation stopped]' : '';

      // Classify the error so the frontend can show a meaningful, translatable message
      const axiosStatus = (err as { response?: { status?: number } })?.response
        ?.status;
      let errorCode: string;
      let retryAfter: number | undefined;

      if (axiosStatus === 429) {
        errorCode = 'RATE_LIMIT';
        const ra = (
          err as {
            response?: { headers?: { 'retry-after'?: string } };
          }
        )?.response?.headers?.['retry-after'];
        retryAfter = ra ? Math.ceil(Number(ra) / 60) : undefined;
      } else if (axiosStatus === 402) {
        errorCode = 'CREDIT_LIMIT';
      } else if (axiosStatus === 401 || axiosStatus === 403) {
        errorCode = 'INVALID_API_KEY';
      } else if (axiosStatus && axiosStatus >= 500) {
        errorCode = 'PROVIDER_UNAVAILABLE';
      } else {
        errorCode = 'PROVIDER_ERROR';
      }

      subject.next(
        new MessageEvent('message', {
          data: JSON.stringify({
            error: `Provider error. Check your API key.${partialNote}`,
            errorCode,
            ...(retryAfter !== undefined ? { retryAfter } : {}),
          }),
        }),
      );
      if (fullContent) {
        const msg = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: ChatRole.ASSISTANT,
            content: fullContent + ' [...]',
            generatedBy,
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
        generatedBy,
        metadata: activeAgentId ? { agentId: activeAgentId } : undefined,
      },
    });
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    // ── D: Parse quickActions / inlineOptions from LLM response ─────────────
    const interactiveData = this.extractInteractivePayload(fullContent);

    subject.next(
      new MessageEvent('message', {
        data: JSON.stringify({
          done: true,
          messageId: assistantMsg.id,
          fullContent,
          ...interactiveData,
        }),
      }),
    );
    subject.complete();
  }

  // ── D: Interactive payload extraction ──────────────────────────────────────

  private extractInteractivePayload(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    // Look for trailing JSON object with quickActions or inlineOptions
    const jsonMatch = content.match(
      /\{[^{}]*"(?:quickActions|inlineOptions)"[^{}]*\}\s*$/,
    );
    if (!jsonMatch) return result;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.quickActions)) {
        result.quickActions = parsed.quickActions;
      }
      if (Array.isArray(parsed.inlineOptions)) {
        result.inlineOptions = parsed.inlineOptions;
      }
    } catch {
      // Not valid JSON — ignore
    }
    return result;
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
        generatedBy: `${session.provider}:${session.model}`,
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

    const results = await Promise.all(
      credentials.map(async (cred) => {
        let models: string[] = PROVIDER_MODELS[cred.provider] ?? [
          cred.selectedModel,
        ];
        try {
          if (this.llmModelsService) {
            const dynamic = await this.llmModelsService.getModels(
              userId,
              cred.provider,
            );
            if (dynamic.models.length > 0) {
              models = dynamic.models.map((m) => m.id);
            }
          }
        } catch {
          // fallback to static list
        }
        return {
          provider: cred.provider,
          label: PROVIDER_LABELS[cred.provider] ?? cred.provider,
          model: cred.selectedModel,
          models,
        };
      }),
    );

    return results;
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
    locale?: string,
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

    // Locale mapping for language directive
    const LOCALE_NAMES: Record<string, string> = {
      es: 'Spanish (español)',
      en: 'English',
      pt: 'Portuguese (português)',
      fr: 'French (français)',
      de: 'German (Deutsch)',
    };
    const effectiveLocale = locale || 'en';
    const langName = LOCALE_NAMES[effectiveLocale] ?? effectiveLocale;
    const langDirective =
      effectiveLocale !== 'en'
        ? `\n\n## MANDATORY LANGUAGE RULE\n**You MUST respond ENTIRELY in ${langName}.** This is non-negotiable. Every word of your response — including technical explanations, market analysis, reasoning, and conclusions — must be in ${langName}. Never mix languages. Never output your internal reasoning in English. The user's platform is configured in ${langName} and expects all communication in that language.`
        : '';

    return `You are KRYPTO, the internal AI trading agent embedded in the CryptoTrader platform. You are not an assistant about the agent — you ARE the agent. You speak in first person as the decision-making intelligence that continuously analyzes markets and executes crypto trading operations.${langDirective}

## Your Identity
- You make autonomous BUY/SELL/HOLD decisions based on technical indicators, news sentiment, and market patterns
- You accumulate and reference your own trading history to improve decisions
- You communicate with technical precision but remain accessible to users of all experience levels
- You have deep knowledge of every feature, indicator, and setting in the CryptoTrader platform

## Multi-Agent Architecture — KRYPTO Intelligence Network

You operate as part of a tightly integrated 6-agent intelligence network. ALL agents are AI — there are no humans behind them. The system routes conversations automatically. When the user mentions another agent by name or asks about a topic that falls under another agent's expertise, the platform detects the intent and switches seamlessly. You should acknowledge transfers naturally (e.g., "Switching you to SIGMA for that market analysis") rather than saying you can't help or offering to create tickets.

### KRYPTO — The Orchestrator (you)
- **Role**: Central intelligence hub. Routes queries to the right specialist, synthesizes cross-agent insights, and provides unified responses when multiple perspectives are needed.
- **When active**: Auto-routing mode ("Let KRYPTO decide"), cross-agent synthesis, general questions spanning multiple domains.
- **Unique ability**: Can consult ALL sub-agents simultaneously for holistic analysis (e.g., "analyze my portfolio" triggers market + risk + operations + blockchain perspectives).
- **Personality**: Confident, decisive, first-person voice. "I analyzed…", "My recommendation is…"

### NEXUS — Platform Guide (id: platform)
- **Role**: Expert in every feature, page, button, and workflow of the CryptoTrader platform. The go-to agent for onboarding, navigation, configuration, and troubleshooting.
- **Deep knowledge**: Dashboard layout, Config panel (agent setup, thresholds, modes), Settings (API keys, LLM providers, profile), Agent Log interpretation, Trade History export, chart controls, notification system, multi-agent chat itself.
- **Typical queries**: "How do I set up a new trading agent?", "Where do I configure stop-loss?", "What does the Overview page show?", "How do I switch to TESTNET mode?"
- **Collaboration**: Hands off to FORGE when the user wants to actually execute a trade (not just learn how). Hands off to AEGIS when risk configuration advice is needed beyond simple navigation.

### FORGE — Operations Specialist (id: operations)
- **Role**: Executes and manages trading operations. Expert in order lifecycle, position tracking, trade history analysis, and operational efficiency.
- **Deep knowledge**: Order types (market, limit, stop-limit), position entry/exit mechanics, trade execution flow, fee calculation, slippage, order book depth, SANDBOX vs TESTNET vs LIVE mode differences, Binance API integration, custody engine internals.
- **Typical queries**: "Open a BTC/USDT position", "What's my P&L on ETH?", "Show me my last 10 trades", "Why did my order not fill?", "Configure an aggressive ETH agent"
- **Collaboration**: Consults SIGMA for entry/exit timing signals. Consults AEGIS before opening large positions to validate risk parameters. Hands off to NEXUS for general platform navigation questions.

### SIGMA — Market Analyst (id: market)
- **Role**: Technical and fundamental market analysis. Reads charts, interprets indicators, identifies trends, and provides actionable market intelligence.
- **Deep knowledge**: RSI, MACD, Bollinger Bands, EMA crossovers, volume analysis, support/resistance levels, candlestick patterns, market microstructure, correlation analysis, news sentiment scoring, macro crypto trends.
- **Typical queries**: "What's the BTC trend right now?", "Is ETH oversold?", "Analyze the MACD crossover", "What does the volume spike mean?", "Give me a market outlook"
- **Collaboration**: Provides signals to FORGE for trade execution. Feeds risk metrics to AEGIS. May reference CIPHER for on-chain data that impacts price (whale movements, exchange flows).

### CIPHER — Blockchain Expert (id: blockchain)
- **Role**: Deep technical knowledge of blockchain technology, protocols, DeFi, smart contracts, and the broader crypto ecosystem.
- **Deep knowledge**: Bitcoin architecture (UTXO, mining, halving), Ethereum (EVM, gas, staking, L2s), consensus mechanisms (PoW, PoS, DPoS), DeFi protocols (AMMs, lending, yield farming), NFTs, DAOs, cross-chain bridges, wallet security, on-chain analytics, regulatory landscape.
- **Typical queries**: "How does Ethereum staking work?", "Explain impermanent loss", "What's the difference between L1 and L2?", "Is this DeFi protocol safe?", "How do smart contracts execute?"
- **Collaboration**: Provides blockchain context to SIGMA for fundamental analysis. Advises AEGIS on protocol-level risks (smart contract risk, bridge risk). Helps NEXUS explain blockchain-related platform features.

### AEGIS — Risk Manager (id: risk)
- **Role**: Portfolio risk assessment, exposure management, and protective strategies. The guardian that ensures the user doesn't overexpose or take uncalculated risks.
- **Deep knowledge**: Portfolio exposure analysis, concentration risk, drawdown metrics, Sharpe ratio, risk-adjusted returns, stop-loss optimization, position sizing (Kelly criterion, fixed fractional), correlation-based diversification, volatility regimes, max drawdown protection, risk score calculation.
- **Typical queries**: "Is my portfolio too concentrated?", "What stop-loss should I set?", "Am I overexposed to BTC?", "Analyze my risk profile", "Rebalance my exposure"
- **Collaboration**: Reviews FORGE operations before execution (risk gate). Uses SIGMA's volatility data for dynamic risk adjustment. References CIPHER for protocol-specific risks in DeFi positions.

### Inter-Agent Collaboration Patterns
- **Trade execution flow**: SIGMA (signal) → AEGIS (risk check) → FORGE (execute) → KRYPTO (report)
- **Portfolio review**: KRYPTO orchestrates all 5 agents → each contributes its perspective → KRYPTO synthesizes
- **New user onboarding**: NEXUS leads → introduces other agents as the user explores features
- **Market alert**: SIGMA detects anomaly → AEGIS evaluates risk impact → FORGE recommends action

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
      effectiveLocale !== 'en'
        ? ` REMINDER: Your ENTIRE response must be in ${langName}. Do NOT output reasoning or thoughts in English.`
        : ''
    }${ragContext ? `\n\n## Knowledge Base Context\n${ragContext}` : ''}`;
  }

  /**
   * Detects if the user's message explicitly requests a transfer to a named agent.
   * Uses keyword matching for agent names and their roles.
   * Returns the target AgentId or null if no transfer intent detected.
   */
  private detectTransferIntent(content: string): AgentId | null {
    const lower = content.toLowerCase();

    // Map agent names (and role synonyms) → AgentId
    const patterns: Array<{ keywords: RegExp; agentId: AgentId }> = [
      {
        keywords:
          /\b(nexus|experto.*(plataforma|platform)|ayuda.*(plataforma|platform)|hablar.*plataforma)\b/i,
        agentId: AgentId.platform,
      },
      {
        keywords:
          /\b(forge|asistente.*operacion|experto.*trading|experto.*operacion|hablar.*operacion)\b/i,
        agentId: AgentId.operations,
      },
      {
        keywords:
          /\b(sigma|an[aá]lisis.*mercado|experto.*mercado|analista.*mercado|hablar.*mercado)\b/i,
        agentId: AgentId.market,
      },
      {
        keywords:
          /\b(cipher|experto.*blockchain|gu[ií]a.*blockchain|hablar.*blockchain|experto.*crypto|experto.*cripto)\b/i,
        agentId: AgentId.blockchain,
      },
      {
        keywords:
          /\b(aegis|experto.*riesgo|an[aá]lisis.*riesgo|hablar.*riesgo|gesti[oó]n.*riesgo)\b/i,
        agentId: AgentId.risk,
      },
    ];

    for (const { keywords, agentId } of patterns) {
      if (keywords.test(lower)) {
        return agentId;
      }
    }

    return null;
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
  ): Promise<StreamUsage> {
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
      case LLMProvider.GEMINI:
        return this.streamGemini(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
      case LLMProvider.MISTRAL:
        return this.streamMistral(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
      case LLMProvider.TOGETHER:
        return this.streamTogether(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
      case LLMProvider.OPENROUTER:
        return this.streamOpenRouter(
          apiKey,
          model,
          systemPrompt,
          messages,
          onDelta,
        );
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
  ): Promise<StreamUsage> {
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

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              message?: {
                usage?: { input_tokens?: number; output_tokens?: number };
              };
              usage?: { output_tokens?: number };
            };
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta.text
            ) {
              onDelta(parsed.delta.text);
            }
            // Capture usage from message_start
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              usage.inputTokens = parsed.message.usage.input_tokens ?? 0;
            }
            // Capture output tokens from message_delta
            if (parsed.type === 'message_delta' && parsed.usage) {
              usage.outputTokens = parsed.usage.output_tokens ?? 0;
            }
          } catch {
            // incomplete chunk — ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
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

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
            // Last chunk contains usage when stream_options.include_usage is true
            if (parsed.usage) {
              usage.inputTokens = parsed.usage.prompt_tokens ?? 0;
              usage.outputTokens = parsed.usage.completion_tokens ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamGroq(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    // Groq uses OpenAI-compatible streaming format
    const resp = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
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

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              x_groq?: {
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              };
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
            // Groq puts usage in x_groq.usage or usage
            const u = parsed.x_groq?.usage ?? parsed.usage;
            if (u) {
              usage.inputTokens = u.prompt_tokens ?? 0;
              usage.outputTokens = u.completion_tokens ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamGemini(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    // Gemini uses its own streaming format via streamGenerateContent
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout: 120_000,
      },
    );

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
      resp.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
              usageMetadata?: {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
              };
            };
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) onDelta(text);
            // Gemini sends usageMetadata in the last chunk
            if (parsed.usageMetadata) {
              usage.inputTokens = parsed.usageMetadata.promptTokenCount ?? 0;
              usage.outputTokens =
                parsed.usageMetadata.candidatesTokenCount ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamMistral(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    // Mistral uses OpenAI-compatible streaming format
    const resp = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
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

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
            if (parsed.usage) {
              usage.inputTokens = parsed.usage.prompt_tokens ?? 0;
              usage.outputTokens = parsed.usage.completion_tokens ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamTogether(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    // Together AI uses OpenAI-compatible streaming format
    const resp = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
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

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
            if (parsed.usage) {
              usage.inputTokens = parsed.usage.prompt_tokens ?? 0;
              usage.outputTokens = parsed.usage.completion_tokens ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  private async streamOpenRouter(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    onDelta: (delta: string) => void,
  ): Promise<StreamUsage> {
    // OpenRouter uses OpenAI-compatible streaming format
    const resp = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
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
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cryptotrader.app',
          'X-Title': 'CryptoTrader',
        },
        responseType: 'stream',
        timeout: 120_000,
      },
    );

    return new Promise<StreamUsage>((resolve, reject) => {
      let buffer = '';
      const usage: StreamUsage = { inputTokens: 0, outputTokens: 0 };
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
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onDelta(text);
            if (parsed.usage) {
              usage.inputTokens = parsed.usage.prompt_tokens ?? 0;
              usage.outputTokens = parsed.usage.completion_tokens ?? 0;
            }
          } catch {
            // ignore
          }
        }
      });
      resp.data.on('end', () => resolve(usage));
      resp.data.on('error', reject);
    });
  }

  // ── D: Process inline option / quick action selection ─────────────────────

  async processSelection(
    userId: string,
    sessionId: string,
    body: { optionId: string; value: string },
  ): Promise<{ action: string; target?: string }> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');

    // Save the selection as a user message for conversation continuity
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: ChatRole.USER,
        content: `[selected: ${body.optionId} = ${body.value}]`,
      },
    });

    return { action: 'selected', target: body.value };
  }
}
