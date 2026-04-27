import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsBadge,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Activity } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsMarketPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('market');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.market.title', 'Market & Charts')}
      />

      <DocsSectionHeader id="market" icon={<Activity className="h-5 w-5" />}>
        {t('docs.market.title', 'Market & Charts')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.intro',
          'The Market page provides real-time price data, OHLCV candlestick charts, and a full technical analysis panel for the four supported trading pairs.',
        )}
      </p>

      {/* Live ticker */}
      <h2 id="live-ticker" className="mb-3 text-lg font-semibold">
        {t('docs.market.tickerTitle', 'Live ticker')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.tickerDesc',
          'At the top of the Market page, the live ticker shows real-time price data for the selected pair via Binance WebSocket. Data updates in milliseconds as the market moves.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.market.field', 'Field'),
          t('docs.market.description', 'Description'),
        ]}
        rows={[
          [
            t('docs.market.currentPrice', 'Current Price'),
            t(
              'docs.market.currentPriceDesc',
              'Last traded price, updates in real-time via WebSocket',
            ),
          ],
          [
            t('docs.market.priceChange', '24h Change'),
            t(
              'docs.market.priceChangeDesc',
              'Price change and percentage over the last 24 hours',
            ),
          ],
          [
            t('docs.market.high24h', '24h High'),
            t('docs.market.high24hDesc', 'Highest price in the last 24 hours'),
          ],
          [
            t('docs.market.low24h', '24h Low'),
            t('docs.market.low24hDesc', 'Lowest price in the last 24 hours'),
          ],
          [
            t('docs.market.volume', '24h Volume'),
            t('docs.market.volumeDesc', 'Total traded volume in 24 hours'),
          ],
        ]}
      />

      {/* Pair selector */}
      <h2 id="pair-selector" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.market.pairTitle', 'Pair selector')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.pairDesc',
          'Use the pill buttons at the top to switch between the four supported pairs. The chart, ticker, and indicators all update for the selected pair.',
        )}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <DocsBadge variant="info">BTCUSDT</DocsBadge>
        <DocsBadge variant="info">BTCUSDC</DocsBadge>
        <DocsBadge variant="info">ETHUSDT</DocsBadge>
        <DocsBadge variant="info">ETHUSDC</DocsBadge>
      </div>

      {/* Chart tab */}
      <h2 id="price-chart" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.market.chartTitle', 'Price chart')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.chartDesc',
          'The Chart tab shows OHLCV (Open, High, Low, Close, Volume) candlestick data for the selected pair. Candles represent 4-hour intervals by default. Volume bars appear below the price chart.',
        )}
      </p>
      <DocsCallout
        variant="info"
        title={t('docs.market.ohlcvNote', 'What is OHLCV?')}
      >
        {t(
          'docs.market.ohlcvDesc',
          'Each candlestick shows: Open (price at start of period), High (maximum price), Low (minimum price), Close (price at end). Green candles = price went up; red candles = price went down.',
        )}
      </DocsCallout>

      {/* Technical indicators tab */}
      <h2
        id="technical-indicators"
        className="mt-10 mb-3 text-lg font-semibold"
      >
        {t('docs.market.indicatorsTitle', 'Technical indicators')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.indicatorsDesc',
          'Switch to the "Technical Analysis" tab to see all indicators the AI agents use when making trading decisions. These are the exact same indicators passed to SIGMA (market analyst) on each cycle.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.market.indicator', 'Indicator'),
          t('docs.market.type', 'Type'),
          t('docs.market.signals', 'Signals'),
        ]}
        rows={[
          [
            'RSI (Relative Strength Index)',
            t('docs.market.momentum', 'Momentum'),
            t(
              'docs.market.rsiSignals',
              '>70 overbought (potential sell), <30 oversold (potential buy)',
            ),
          ],
          [
            'MACD',
            t('docs.market.trend', 'Trend'),
            t(
              'docs.market.macdSignals',
              'MACD line crossing above signal = bullish, below = bearish',
            ),
          ],
          [
            'Bollinger Bands',
            t('docs.market.volatility', 'Volatility'),
            t(
              'docs.market.bbSignals',
              'Price near upper band = overbought; near lower band = oversold',
            ),
          ],
          [
            t('docs.market.volume', 'Volume'),
            t('docs.market.volumeType', 'Volume'),
            t(
              'docs.market.volumeSignals',
              'High volume confirms price moves; low volume = weak signal',
            ),
          ],
          [
            'EMA 9 / EMA 21',
            t('docs.market.movingAvg', 'Moving Average'),
            t(
              'docs.market.emaSignals',
              'Short EMA crossing above long EMA = bullish signal',
            ),
          ],
          [
            'Stochastic RSI',
            t('docs.market.momentum', 'Momentum'),
            t(
              'docs.market.stochSignals',
              'Combines RSI and stochastic for finer momentum readings',
            ),
          ],
        ]}
      />
      <DocsCallout
        variant="tip"
        title={t('docs.market.indicatorsTip', 'How the AI uses indicators')}
      >
        {t(
          'docs.market.indicatorsTipDesc',
          'SIGMA (market analyst) receives all indicator values and interprets them holistically — it does not use hard-coded rules like "RSI > 70 = sell". Instead, it considers all signals together with recent price action and volume to provide a nuanced market assessment.',
        )}
      </DocsCallout>

      {/* Bot Analysis link */}
      <h2 id="market-to-analysis" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.market.analysisTitle', 'From market to decision')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.market.analysisDesc',
          'The technical data from the Market page feeds directly into the Bot Analysis page, which combines it with news sentiment and agent history to produce a combined confidence score. Navigate to Bot Analysis to see the full picture.',
        )}
      </p>

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
