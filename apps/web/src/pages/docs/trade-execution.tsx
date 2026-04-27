import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsSteps,
  DocsTable,
  DocsCallout,
  DocsCodeBlock,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { BarChart2 } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsTradeExecutionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('trade-execution');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.tradeExecution.title', 'Trade Execution')}
      />

      <DocsSectionHeader
        id="trade-execution"
        icon={<BarChart2 className="h-5 w-5" />}
      >
        {t('docs.tradeExecution.title', 'Trade Execution')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.tradeExecution.intro',
          'How trades are executed, buy/sell rules, fee calculations, and real examples.',
        )}
      </p>

      {/* Buy flow */}
      <h2 id="buy-execution" className="mb-3 text-lg font-semibold">
        {t('docs.tradeExecution.buyTitle', 'Buy execution flow')}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.tradeExecution.buyStep1',
              'Confidence check — Agent confidence must exceed buy threshold',
            ),
          },
          {
            title: t(
              'docs.tradeExecution.buyStep2',
              'Capital check — Verify sufficient balance (available × maxTradePct)',
            ),
          },
          {
            title: t(
              'docs.tradeExecution.buyStep3',
              'Position check — Open positions < maxConcurrentPositions',
            ),
          },
          {
            title: t(
              'docs.tradeExecution.buyStep4',
              'Execute order — Market order on Binance (LIVE/TESTNET) or simulate (SANDBOX)',
            ),
          },
          {
            title: t(
              'docs.tradeExecution.buyStep5',
              'Create position — Record entry price, quantity, and fees',
            ),
          },
        ]}
      />

      {/* Sell paths */}
      <h2 id="sell-paths" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.tradeExecution.sellTitle', 'Sell execution paths')}
      </h2>
      <DocsCallout
        variant="info"
        title={t('docs.tradeExecution.sellPath1', '1. AI-recommended SELL')}
      >
        {t(
          'docs.tradeExecution.sellPath1Desc',
          'Agent analyzes market and recommends selling. Requires: confidence > sell threshold AND profit > minProfitPct (0.3%). Will NEVER sell at loss via LLM.',
        )}
      </DocsCallout>
      <div className="mt-3">
        <DocsCallout
          variant="tip"
          title={t('docs.tradeExecution.sellPath2', '2. Take-profit trigger')}
        >
          {t(
            'docs.tradeExecution.sellPath2Desc',
            'Automatic: when price rises by takeProfitPct from entry. No AI needed — triggers on price alone.',
          )}
        </DocsCallout>
      </div>
      <div className="mt-3">
        <DocsCallout
          variant="danger"
          title={t('docs.tradeExecution.sellPath3', '3. Stop-loss trigger')}
        >
          {t(
            'docs.tradeExecution.sellPath3Desc',
            'Automatic: when price drops by stopLossPct from entry. The only mechanism that can close at a loss. Hard safety limit.',
          )}
        </DocsCallout>
      </div>
      <div className="mt-3">
        <DocsCallout
          variant="warning"
          title={t('docs.tradeExecution.sellPath4', '4. Manual close')}
        >
          {t(
            'docs.tradeExecution.sellPath4Desc',
            'User clicks "Close Position". No restrictions — can close at any price. Useful for emergency exits.',
          )}
        </DocsCallout>
      </div>

      {/* Priority table */}
      <h2 id="execution-priority" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.tradeExecution.priorityTitle', 'Execution priority')}
      </h2>
      <DocsTable
        headers={[
          t('docs.tradeExecution.priority', 'Priority'),
          t('docs.tradeExecution.mechanism', 'Mechanism'),
          t('docs.tradeExecution.canLoss', 'Can close at loss?'),
          t('docs.tradeExecution.needsAI', 'Needs AI?'),
        ]}
        rows={[
          ['1 (highest)', 'Stop Loss', '✅ Yes', 'No'],
          ['2', 'Take Profit', 'No (always profit)', 'No'],
          ['3', 'AI SELL', '❌ No (minProfit gate)', 'Yes'],
          ['4', 'Manual close', '✅ Yes', 'No'],
        ]}
      />

      {/* Fees */}
      <h2 id="fee-calculation" className="mt-10 mb-3 text-lg font-semibold">
        {t('help.binanceIntegration.feesTitle', 'Fee calculation')}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {t(
          'help.binanceIntegration.feesDesc',
          'All trades on Binance incur a 0.1% fee (taker fee for market orders).',
        )}
      </p>
      <DocsCodeBlock
        code={`Entry fee = entryPrice × quantity × 0.001\nExit fee  = exitPrice × quantity × 0.001\nNet PnL   = (exitPrice − entryPrice) × quantity − (entryFee + exitFee)`}
        language="text"
        title={t('docs.tradeExecution.formulas', 'Formulas')}
      />

      <div className="mt-4">
        <DocsCallout
          variant="info"
          title={t('help.binanceIntegration.feesExampleTitle', 'Real example')}
        >
          {t(
            'help.binanceIntegration.feesExampleSetup',
            'Buy 0.01 BTC at $85,000 · sell at $87,000',
          )}
          : Gross PnL $20.00 − fees $1.72 = <strong>Net PnL $18.28</strong>
        </DocsCallout>
      </div>

      <DocsPageFeedback
          question={t('docs.feedback.question', 'Was this page helpful?')}
          yesLabel={t('docs.feedback.yes', 'Yes')}
          noLabel={t('docs.feedback.no', 'No')}
          thanksYes={t('docs.feedback.thanksYes', 'Thanks for your feedback!')}
          thanksNo={t('docs.feedback.thanksNo', "Thanks — we'll work on improving this page.")}
        />

      <DocsPagination
        prev={
          prev ? { title: t(SLUG_TITLE_KEY_MAP[prev.slug] ?? prev.slug, prev.title), href: `/docs/${prev.slug}` } : undefined
        }
        next={
          next
            ? {
                title: t(SLUG_TITLE_KEY_MAP[next.slug] ?? next.slug, next.title),
                href: `/docs/${next.slug}`,
                description: next.description,
              }
            : undefined
        }
        previousLabel={t('docs.pagination.previous', 'Previous')}
        nextLabel={t('docs.pagination.next', 'Next')}
        onNavigate={(href) => {
          navigate(href);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
