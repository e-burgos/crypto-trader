/**
 * Spec 30 — ToolCallCard Page Object
 * Locators del componente ToolCallCard (Spec 28 — FORGE tool calling)
 */
import { Page, Locator } from '@playwright/test';

export class ToolCallCard {
  readonly page: Page;
  readonly card: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly toolName: Locator;
  readonly paramsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.getByTestId('tool-call-card');
    this.confirmButton = this.card.getByRole('button', {
      name: /confirmar|confirm/i,
    });
    this.cancelButton = this.card.getByRole('button', {
      name: /cancelar|cancel/i,
    });
    this.toolName = this.card.getByTestId('tool-name');
    this.paramsList = this.card.getByTestId('tool-params');
  }

  async confirm() {
    await this.confirmButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}
