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
  readonly trigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.getByTestId('agent-selector-trigger');
  }

  agentCard(agentId: AgentId): Locator {
    return this.page.getByTestId(`agent-card-${agentId}`);
  }

  /** El selector es un dropdown: las tarjetas solo existen con el panel abierto. */
  async open() {
    if (await this.page.getByTestId('agent-card-auto').isVisible().catch(() => false)) {
      return;
    }
    await this.trigger.click();
    await this.page
      .getByTestId('agent-card-auto')
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  async select(agentId: AgentId) {
    await this.open();
    await this.agentCard(agentId).click();
  }

  async selectAutoRoute() {
    await this.open();
    await this.page.getByTestId('agent-card-auto').click();
  }
}
