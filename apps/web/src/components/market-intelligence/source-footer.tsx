import { ExternalLink } from 'lucide-react';

/** Maps internal source slug → display info */
const SOURCE_INFO: Record<string, { label: string; url: string }> = {
  'alternative-me': {
    label: 'Alternative.me',
    url: 'https://alternative.me/crypto/fear-and-greed-index/',
  },
  coinalyze: {
    label: 'Coinalyze',
    url: 'https://coinalyze.net',
  },
  defillama: {
    label: 'DeFiLlama',
    url: 'https://defillama.com',
  },
  coingecko: {
    label: 'CoinGecko',
    url: 'https://www.coingecko.com',
  },
  cryptopanic: {
    label: 'CryptoPanic',
    url: 'https://cryptopanic.com',
  },
  polymarket: {
    label: 'Polymarket',
    url: 'https://polymarket.com',
  },
  'token-unlocks': {
    label: 'Token Unlocks',
    url: 'https://token.unlocks.app',
  },
  altfins: {
    label: 'altFINS',
    url: 'https://altfins.com',
  },
  finnhub: {
    label: 'Finnhub',
    url: 'https://finnhub.io',
  },
};

export function SourceFooter({ source }: { source: string }) {
  const info = SOURCE_INFO[source];
  if (!info) return null;

  return (
    <div className="flex items-center gap-1.5 ">
      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
        Source:
      </span>
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
      >
        {info.label}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}
