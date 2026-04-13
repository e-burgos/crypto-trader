/**
 * Spec 30 — AgentSelectorPage Page Object
 * Locators del componente AgentSelector (Spec 28)
 */
import { Page, Locator } from '@playwright/test';

export type AgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk';

export const AGENT_NAMES: Record<AgentId, string> = {
  platform: 'NEXUS',
  operations: 'FORGE',
  market: 'SIGMA',
  blockchain: 'CIPHER',
  risk: 'AEGIS',
};

export class AgentSelectorPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  agentCard(agentId: AgentId): Locator {
    return this.page.getByTestId(`agent-card-${agentId}`);
  }

  async select(agentId: AgentId) {
    // The card itself is the button — just click it directly
    await this.agentCard(agentId).click();
  }

  async selectAutoRoute() {
    await this.page.getByTestId('agent-card-auto').click();
  }
}
