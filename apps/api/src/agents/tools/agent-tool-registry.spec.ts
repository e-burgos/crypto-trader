import { AgentToolRegistry } from './agent-tool-registry';
import { AgentToolName } from '../../../generated/prisma/enums';
import { AgentTool, AgentToolInput, AgentToolOutput } from './agent-tool.interface';

// Minimal mock tool
class MockTool implements AgentTool {
  readonly name: AgentToolName;
  callCount = 0;

  constructor(name: AgentToolName) {
    this.name = name;
  }

  async execute(_input: AgentToolInput): Promise<AgentToolOutput> {
    this.callCount++;
    return {
      data: { mock: true, ts: Date.now() },
      tokenEstimate: 50,
      freshnessMs: 0,
    };
  }
}

function createMockPrisma() {
  return {
    agentToolInvocation: {
      create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
  } as any;
}

function buildRegistry(prisma?: any) {
  const p = prisma ?? createMockPrisma();
  const tools = Object.values(AgentToolName).map(
    (n) => new MockTool(n as AgentToolName),
  );
  const registry = new AgentToolRegistry(
    p,
    tools[0] as any, // portfolio
    tools[1] as any, // market
    tools[2] as any, // trade sim
    tools[3] as any, // risk
    tools[4] as any, // decision
    tools[5] as any, // token
  );
  registry.onModuleInit();
  return { registry, tools, prisma: p };
}

describe('AgentToolRegistry', () => {
  it('registers and retrieves all 6 tools', () => {
    const { registry } = buildRegistry();
    expect(registry.getAll()).toHaveLength(6);

    for (const name of Object.values(AgentToolName)) {
      expect(registry.get(name as AgentToolName)).toBeDefined();
    }
  });

  it('returns undefined for unknown tool name', () => {
    const { registry } = buildRegistry();
    expect(registry.get('UNKNOWN' as AgentToolName)).toBeUndefined();
  });

  it('execute() calls the tool and logs invocation', async () => {
    const prisma = createMockPrisma();
    const { registry } = buildRegistry(prisma);

    const result = await registry.execute(AgentToolName.PORTFOLIO_CONTEXT, {
      userId: 'user-1',
    });

    expect(result.data).toBeDefined();
    expect(result.tokenEstimate).toBe(50);

    // Wait for fire-and-forget log
    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.agentToolInvocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          toolName: AgentToolName.PORTFOLIO_CONTEXT,
          status: 'SUCCESS',
        }),
      }),
    );
  });

  it('cache returns cached output within TTL', async () => {
    const { registry, tools } = buildRegistry();
    const portfolioTool = tools[0] as MockTool;

    const input: AgentToolInput = { userId: 'user-1' };

    // First call
    await registry.execute(AgentToolName.PORTFOLIO_CONTEXT, input);
    expect(portfolioTool.callCount).toBe(1);

    // Second call — should be cached (PORTFOLIO_CONTEXT TTL = 30s)
    await registry.execute(AgentToolName.PORTFOLIO_CONTEXT, input);
    expect(portfolioTool.callCount).toBe(1); // still 1, served from cache
  });

  it('cache misses after TTL expiration', async () => {
    const { registry, tools } = buildRegistry();
    const portfolioTool = tools[0] as MockTool;

    const input: AgentToolInput = { userId: 'user-1' };

    // First call
    await registry.execute(AgentToolName.PORTFOLIO_CONTEXT, input);
    expect(portfolioTool.callCount).toBe(1);

    // Manually expire cache
    registry.clearCache();

    // Third call — should miss cache
    await registry.execute(AgentToolName.PORTFOLIO_CONTEXT, input);
    expect(portfolioTool.callCount).toBe(2);
  });

  it('TRADE_SIMULATION is never cached (TTL=0)', async () => {
    const { registry, tools } = buildRegistry();
    const tradeTool = tools[2] as MockTool;

    const input: AgentToolInput = { userId: 'user-1' };

    await registry.execute(AgentToolName.TRADE_SIMULATION, input);
    await registry.execute(AgentToolName.TRADE_SIMULATION, input);
    expect(tradeTool.callCount).toBe(2);
  });

  it('throws when tool not found', async () => {
    const { registry } = buildRegistry();
    await expect(
      registry.execute('UNKNOWN' as AgentToolName, { userId: 'u' }),
    ).rejects.toThrow('Tool not found: UNKNOWN');
  });
});
