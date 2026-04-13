/**
 * Spec 30 — AdminAgentsPage Page Object
 * Locators del panel /admin/agents (Spec 28)
 */
import { Page, Locator } from '@playwright/test';
import path from 'path';

export const TEST_DOC_PATH = path.join(__dirname, '../fixtures/test-doc.md');

export class AdminAgentsPage {
  readonly page: Page;
  readonly agentList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentList = page.getByTestId('agent-list');
  }

  async goto() {
    await this.page.goto('/admin/agents');
  }

  agentCard(agentId: string): Locator {
    return this.page.getByTestId(`admin-agent-${agentId}`);
  }

  async openEditor(agentId: string) {
    await this.agentCard(agentId)
      .getByRole('button', { name: /editar|edit/i })
      .click();
  }

  async goToKnowledgeTab() {
    await this.page
      .getByRole('tab', { name: /conocimiento|knowledge/i })
      .click();
  }

  async goToDiagnosticTab() {
    await this.page
      .getByRole('tab', { name: /diagnóstico|diagnostic/i })
      .click();
  }

  async uploadDocument(filePath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.getByRole('button', { name: /subir|upload/i }).click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async waitForDocumentReady(docName: string, timeout = 30_000) {
    // Polling: esperar que el badge de status cambie a READY
    await this.page
      .locator(`[data-doc-name="${docName}"] [data-status="READY"]`)
      .or(this.page.getByTestId(`doc-status-${docName}`).getByText(/ready/i))
      .waitFor({ timeout });
  }

  async runRagTest(query: string) {
    await this.page
      .getByRole('textbox', { name: /test rag|pregunta|query/i })
      .fill(query);
    await this.page
      .getByRole('button', { name: /test|probar/i })
      .last()
      .click();
  }
}
