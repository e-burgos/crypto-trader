import { AgentToolName } from '../../../generated/prisma/enums';

export interface AgentToolInput {
  userId: string;
  configId?: string;
  pair?: string;
  asset?: string;
  mode?: string;
  agentId?: string;
  [key: string]: unknown;
}

export interface AgentToolOutput {
  data: Record<string, unknown>;
  tokenEstimate: number;
  freshnessMs: number;
}

export interface AgentTool {
  readonly name: AgentToolName;
  execute(input: AgentToolInput): Promise<AgentToolOutput>;
}
