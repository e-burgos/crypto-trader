/**
 * Spec 30 — ChatPage Page Object
 * Locators y acciones del chat widget + página /dashboard/chat
 */
import { Page, Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentHeader: Locator;
  readonly messageList: Locator;
  readonly changeAgentButton: Locator;
  readonly orchestratingIndicator: Locator;
  readonly agentSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page
      .getByTestId('chat-input')
      .or(page.getByRole('textbox', { name: /mensaje|message/i }));
    this.sendButton = page.getByRole('button', { name: /enviar|send/i });
    this.agentHeader = page.getByTestId('agent-header');
    this.messageList = page.getByTestId('chat-messages');
    this.changeAgentButton = page.getByRole('button', {
      name: /cambiar agente|change agent/i,
    });
    this.orchestratingIndicator = page.getByTestId('orchestrating-indicator');
    this.agentSelector = page.getByTestId('agent-selector');
  }

  async goto() {
    await this.page.goto('/dashboard/chat');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navega a /dashboard/chat y crea una nueva sesión SIEMPRE.
   * Necesario para ver AgentSelector con estado limpio (sin mensajes previos).
   */
  async gotoWithSession() {
    await this.page.goto('/dashboard/chat');
    await this.page.waitForLoadState('networkidle');

    // Siempre crear una nueva sesión para tener estado limpio
    // (evitar re-usar sesiones con mensajes previos)
    const newSessionBtn = this.page
      .getByRole('button', { name: /new session|nueva sesión/i })
      .or(this.page.getByRole('button', { name: /\+ New session/i }))
      .first();

    // Wait for either the button or agentSelector (if session already created for this test)
    await Promise.race([
      newSessionBtn.waitFor({ state: 'visible', timeout: 8_000 }),
      this.agentSelector.waitFor({ state: 'visible', timeout: 8_000 }),
    ]).catch(() => {});

    // If new session button is visible, click it to create a fresh session
    const btnVisible = await newSessionBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await newSessionBtn.click();

      // Wait for modal to open — click the "Select AI..." dropdown
      const providerDropdown = this.page
        .getByRole('button', { name: /Select AI|Seleccionar/i })
        .first();
      await providerDropdown.waitFor({ state: 'visible', timeout: 8_000 });
      await providerDropdown.click();

      // Click the first visible provider option (e.g. "Groq")
      await this.page.waitForTimeout(400);
      const providerOption = this.page
        .locator('[class*="z-50"] li button')
        .first();
      const hasZIndexOption = await providerOption
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      if (hasZIndexOption) {
        await providerOption.click();
      } else {
        await this.page.locator('ul li').first().click();
      }

      // Wait for "Start session" button to become enabled
      const startBtn = this.page.getByRole('button', {
        name: /Start session|Iniciar sesión/i,
      });
      await startBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await expect(startBtn).toBeEnabled({ timeout: 8_000 });
      await startBtn.click();

      // Wait for session to be created (AgentSelector should appear)
      await this.agentSelector.waitFor({ state: 'visible', timeout: 15_000 });
    }
    // AgentSelector is now visible (either existing or newly created session)
    await this.agentSelector.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    // Use Enter key — the ChatInput handles Enter to send (Shift+Enter for newline)
    await this.chatInput.press('Enter');
  }

  async waitForStreamComplete(timeout = 30_000) {
    await this.page.waitForFunction(
      () => !document.querySelector('[data-streaming="true"]'),
      { timeout },
    );
  }

  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator('[data-role="assistant"]');
    const last = messages.last();
    return last.innerText();
  }
}
