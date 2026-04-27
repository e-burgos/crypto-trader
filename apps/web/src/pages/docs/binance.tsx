import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsCodeBlock,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Landmark } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsBinancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('binance');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.integration', 'Integration')}
        page={t('docs.binance.title', 'Binance Integration')}
      />

      <DocsSectionHeader id="binance" icon={<Landmark className="h-5 w-5" />}>
        {t('docs.binance.title', 'Binance Integration')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.binance.intro',
          'How CryptoTrader integrates with Binance for data feeds and trade execution.',
        )}
      </p>

      {/* Trading pairs */}
      <h2 id="trading-pairs" className="mb-3 text-lg font-semibold">
        {t('docs.binance.pairsTitle', 'Supported trading pairs')}
      </h2>
      <DocsTable
        headers={[
          t('docs.binance.pair', 'Pair'),
          t('docs.binance.base', 'Base'),
          t('docs.binance.quote', 'Quote'),
          t('docs.binance.minOrder', 'Min order'),
        ]}
        rows={[
          ['BTCUSDT', 'BTC', 'USDT', '~$10'],
          ['BTCUSDC', 'BTC', 'USDC', '~$10'],
          ['ETHUSDT', 'ETH', 'USDT', '~$10'],
          ['ETHUSDC', 'ETH', 'USDC', '~$10'],
        ]}
      />

      {/* API permissions */}
      <h2 id="api-permissions" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.binance.permissionsTitle', 'Required API permissions')}
      </h2>
      <DocsTable
        headers={[
          t('docs.binance.permission', 'Permission'),
          t('docs.binance.why', 'Why'),
          t('docs.binance.sandbox', 'Sandbox'),
        ]}
        rows={[
          [
            t('docs.binance.readInfo', 'Read Info'),
            t('docs.binance.readInfoWhy', 'Balance, order history'),
            t('docs.binance.notNeeded', 'Not needed'),
          ],
          [
            t('docs.binance.enableTrading', 'Enable Trading'),
            t('docs.binance.enableTradingWhy', 'Place buy/sell orders'),
            t('docs.binance.notNeeded', 'Not needed'),
          ],
        ]}
      />
      <DocsCallout
        variant="danger"
        title={t(
          'docs.binance.noWithdrawal',
          'Never enable "Enable Withdrawals"',
        )}
      >
        {t(
          'docs.binance.noWithdrawalDesc',
          'CryptoTrader never needs withdrawal permissions. Never grant this. IP-restrict your keys to an additional layer of protection.',
        )}
      </DocsCallout>

      {/* Data pipeline */}
      <h2 id="data-pipeline" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.binance.pipelineTitle', 'Data pipeline')}
      </h2>
      <DocsTable
        headers={[
          t('docs.binance.data', 'Data'),
          t('docs.binance.source', 'Source'),
          t('docs.binance.frequency', 'Frequency'),
        ]}
        rows={[
          [
            t('docs.binance.realTimePrice', 'Real-time price'),
            'WebSocket',
            t('docs.binance.realTime', 'Real-time'),
          ],
          [
            t('docs.binance.ohlcv', 'OHLCV candles'),
            'REST API',
            t('docs.binance.perCycle', 'Per analysis cycle'),
          ],
          [
            'Order book',
            'REST API',
            t('docs.binance.perCycle', 'Per analysis cycle'),
          ],
          [
            t('docs.binance.accountBalance', 'Account balance'),
            'REST API',
            t('docs.binance.every30s', 'Every 30 seconds'),
          ],
        ]}
      />

      {/* Rate limits */}
      <h2 id="rate-limits" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.binance.rateLimitsTitle', 'Rate limits')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.binance.rateLimitsDesc',
          'Binance imposes rate limits on API usage. The platform manages this automatically:',
        )}
      </p>
      <DocsCodeBlock
        code={`REST API:   1,200 requests/minute (weight-based)\nWebSocket:  5 connections per IP\nOrders:     10 orders/second, 200,000 orders/day`}
        language="text"
        title={t('docs.binance.rateLimitsCode', 'Binance limits')}
      />

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
