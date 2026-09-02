/**
 * Spec 30 — ChatPage Page Object
 * Locators y acciones del chat widget + página /dashboard/chat
 */
import { Page, Locator } from '@playwright/test';
import { API_BASE } from '../helpers/llm-availability';

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
    // networkidle nunca ocurre: el chat mantiene WebSocket/SSE abiertos
    await this.page
      .getByRole('button', { name: /new session/i })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
  }

  /**
   * Navega a /dashboard/chat con una sesión nueva y vacía activa.
   * El AgentSelector solo se renderiza con una sesión activa, y la UI ya no
   * ofrece un modal para crearla: se crea por API (no consume tokens del LLM)
   * y se activa por el localStorage que usa el store del chat.
   */
  async gotoWithSession() {
    await this.goto();

    const token = await this.page.evaluate(() =>
      localStorage.getItem('accessToken'),
    );
    const optionsRes = await this.page.request.get(
      `${API_BASE}/chat/llm-options`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const options = (await optionsRes.json()) as Array<{
      provider: string;
      model?: string;
      models: string[];
    }>;
    const option = options[0];
    const created = await this.page.request.post(`${API_BASE}/chat/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        provider: option.provider,
        model: option.model ?? option.models[0],
      },
    });
    const session = (await created.json()) as { id: string };

    await this.page.evaluate(
      (id) => localStorage.setItem('chat:activeSessionId', id),
      session.id,
    );
    await this.page.reload();
    await this.agentSelector.waitFor({ state: 'visible', timeout: 30_000 });
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
