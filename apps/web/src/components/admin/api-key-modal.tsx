import { useState } from 'react';
import { TabModal } from '@crypto-trader/ui';
import { Key, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSetCredential } from '../../hooks/use-data-sources';
import type { DataSourceStatus } from '@crypto-trader/shared';

interface ApiKeyModalProps {
  source: DataSourceStatus;
  onClose: () => void;
}

/**
 * Map of data source names to their platform documentation/API key pages.
 */
const PLATFORM_LINKS: Record<string, { url: string; label: string }> = {
  coinalyze: {
    url: 'https://coinalyze.net/',
    label: 'Coinalyze Platform',
  },
  finnhub: {
    url: 'https://finnhub.io/register',
    label: 'Finnhub Dashboard',
  },
  coingecko: {
    url: 'https://www.coingecko.com/en/api/pricing',
    label: 'CoinGecko API Plans',
  },
  messari: {
    url: 'https://messari.io/api',
    label: 'Messari API Portal',
  },
  altfins: {
    url: 'https://platform.altfins.com/',
    label: 'altFINS Platform',
  },
  alternative_me: {
    url: 'https://alternative.me/crypto/fear-and-greed-index/#api',
    label: 'Alternative.me API Docs',
  },
  defillama: {
    url: 'https://defillama.com/docs/api',
    label: 'DefiLlama API Docs',
  },
  polymarket: {
    url: 'https://github.com/Polymarket/py-clob-client#readme',
    label: 'Polymarket CLOB Client',
  },
};

const API_KEY_INSTRUCTIONS: Record<string, string> = {
  coinalyze:
    'Coinalyze API access is not publicly available. Contact support@coinalyze.net to request API access or check if your existing account includes API credentials.',
  finnhub:
    'Register at finnhub.io for a free account. Your API key is shown in the dashboard immediately after registration.',
  coingecko:
    'CoinGecko Pro API requires a paid plan. Sign up at coingecko.com, subscribe to a plan, and copy your API key from the developer dashboard.',
  messari:
    'Create an account at messari.io/api. Free tier includes basic endpoints. Your API key is available in account settings.',
  altfins:
    'Subscribe to altFINS platform. API access is available on paid plans. Find your key in Settings > API.',
  alternative_me:
    'Alternative.me Fear & Greed Index API is free and does not require an API key. No registration needed.',
  defillama:
    'DefiLlama API is free and open. No API key required. Access all endpoints without authentication.',
  polymarket:
    'Polymarket Gamma API is publicly accessible. No API key required for read-only market data.',
};

export function ApiKeyModal({ source, onClose }: ApiKeyModalProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const { mutate: setCredential, isPending } = useSetCredential();

  const platformLink = PLATFORM_LINKS[source.name];
  const instructions =
    API_KEY_INSTRUCTIONS[source.name] ??
    t('admin.dataSources.apiKeyModal.genericInstructions');

  function handleSave() {
    if (!apiKey.trim()) return;
    setCredential(
      { id: source.id, apiKey: apiKey.trim() },
      { onSuccess: () => onClose() },
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              {t('admin.dataSources.apiKeyModal.howToGet')}
            </p>
            <p className="text-xs text-muted-foreground">{instructions}</p>
          </div>
        </div>
      </div>

      {/* Platform link */}
      {platformLink && (
        <a
          href={platformLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-primary hover:bg-primary/5 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="font-medium">{platformLink.label}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {t('admin.dataSources.apiKeyModal.opensNewTab')}
          </span>
        </a>
      )}

      {/* API Key input */}
      <div className="space-y-1.5">
        <label
          htmlFor="api-key-input"
          className="text-xs font-medium text-foreground"
        >
          {t('admin.dataSources.apiKeyModal.inputLabel')}
        </label>
        <input
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('admin.dataSources.apiKeyModal.inputPlaceholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoComplete="off"
          autoFocus
        />
        <p className="text-[10px] text-muted-foreground">
          {t('admin.dataSources.apiKeyModal.encryptionNote')}
        </p>
      </div>
    </div>
  );

  return (
    <TabModal
      icon={Key}
      title={t('admin.dataSources.apiKeyModal.title')}
      subtitle={source.displayName}
      content={content}
      footerLabel={source.baseUrl}
      successButton={{
        label: isPending
          ? t('admin.dataSources.apiKeyModal.saving')
          : t('admin.dataSources.apiKeyModal.save'),
        onClick: handleSave,
      }}
      closeLabel={t('admin.dataSources.apiKeyModal.cancel')}
      onClose={onClose}
    />
  );
}
