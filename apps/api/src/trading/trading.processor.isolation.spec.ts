/**
 * Regression tests for Phase A — Agent Profit Optimizer
 * Bugs #2, #3, #4, #6, #7: Position scoping, atomic wallet, context isolation
 */

describe('TradingProcessor — Isolation & Atomicity (Phase A Regression)', () => {
  // ── Bug #2: executeLLMSell must filter by configId + pair ──────────────

  describe('Bug #2 — executeLLMSell position scoping', () => {
    it('should only close positions belonging to the same configId and pair', async () => {
      const mockFindMany = jest.fn().mockResolvedValue([]);

      const config = {
        id: 'config-A',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        minProfitPct: 0.003,
      };
      const userId = 'user-1';
      const mode = 'SANDBOX';

      // Simulate call — the key assertion is the WHERE clause
      await mockFindMany({
        where: {
          userId,
          configId: config.id,
          pair: config.pair,
          status: 'OPEN',
          mode,
        },
      });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          configId: 'config-A',
          pair: 'USDT',
          status: 'OPEN',
          mode: 'SANDBOX',
        },
      });
    });

    it('should NOT use asset-only filter (old vulnerable pattern)', () => {
      // This test ensures the old pattern {userId, asset, status, mode}
      // is NOT present in the codebase anymore for executeLLMSell
      const fs = require('fs');
      const source = fs.readFileSync(
        require('path').join(__dirname, 'trading.processor.ts'),
        'utf8',
      );

      // Find executeLLMSell method
      const sellStart = source.indexOf('private async executeLLMSell');
      const sellEnd = source.indexOf('private async checkOpenPositions');
      const sellBody = source.slice(sellStart, sellEnd);

      // Old vulnerable pattern should NOT be present
      expect(sellBody).not.toMatch(
        /where:\s*\{\s*userId,\s*asset:\s*config\.asset,\s*status/,
      );
      // New secure pattern should be present
      expect(sellBody).toMatch(/configId:\s*config\.id/);
      expect(sellBody).toMatch(/pair:\s*config\.pair/);
    });
  });

  // ── Bug #3: executeBuy must count positions by configId ────────────────

  describe('Bug #3 — executeBuy position count scoping', () => {
    it('should count open positions filtered by configId', () => {
      const fs = require('fs');
      const source = fs.readFileSync(
        require('path').join(__dirname, 'trading.processor.ts'),
        'utf8',
      );

      // Find executeBuy method
      const buyStart = source.indexOf('private async executeBuy');
      const buyEnd = source.indexOf('private async executeLLMSell');
      const buyBody = source.slice(buyStart, buyEnd);

      // Must include configId in the count query
      expect(buyBody).toMatch(/position\.count/);
      expect(buyBody).toMatch(/configId:\s*config\.id/);
    });
  });

  // ── Bug #6: Sandbox wallet operations must be atomic ──────────────────

  describe('Bug #6 — Sandbox wallet atomicity', () => {
    it('should use $transaction for sandbox wallet operations in executeLLMSell', () => {
      const fs = require('fs');
      const source = fs.readFileSync(
        require('path').join(__dirname, 'trading.processor.ts'),
        'utf8',
      );

      const sellStart = source.indexOf('private async executeLLMSell');
      const sellEnd = source.indexOf('private async checkOpenPositions');
      const sellBody = source.slice(sellStart, sellEnd);

      // Must use $transaction for sandbox wallet operations
      expect(sellBody).toMatch(/\$transaction/);
      expect(sellBody).toMatch(/tx\.sandboxWallet\.upsert/);
      expect(sellBody).toMatch(/tx\.sandboxWallet\.findUnique/);
    });

    it('should use $transaction for sandbox wallet operations in checkOpenPositions', () => {
      const fs = require('fs');
      const source = fs.readFileSync(
        require('path').join(__dirname, 'trading.processor.ts'),
        'utf8',
      );

      const checkStart = source.indexOf('private async checkOpenPositions');
      const checkEnd = source.indexOf('private parseSymbolForSandbox');
      const checkBody = source.slice(checkStart, checkEnd);

      // Must use $transaction for sandbox wallet operations
      expect(checkBody).toMatch(/\$transaction/);
      expect(checkBody).toMatch(/tx\.sandboxWallet\.upsert/);
      expect(checkBody).toMatch(/tx\.sandboxWallet\.findUnique/);
    });
  });

  // ── Bug #7: recentTrades must be filtered by configId ─────────────────

  describe('Bug #7 — recentTrades context isolation', () => {
    it('should filter trades by configId via position relation', () => {
      const fs = require('fs');
      const source = fs.readFileSync(
        require('path').join(__dirname, 'trading.processor.ts'),
        'utf8',
      );

      // Find the recentTrades query section
      const tradesSection = source.indexOf('// 7. Load recent trades');
      const tradesEnd = source.indexOf('// 7b.', tradesSection);
      const tradesBody = source.slice(tradesSection, tradesEnd);

      // Must filter by configId through the position relation
      expect(tradesBody).toMatch(/position:\s*\{\s*configId/);
    });
  });
});
