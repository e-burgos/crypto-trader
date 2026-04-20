import { useState } from 'react';
import {
  Key,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TestTube2,
} from 'lucide-react';
import { Button, InfoTooltip, Input } from '@crypto-trader/ui';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  useBinanceKeyStatus,
  useTestnetBinanceKeyStatus,
  useSetBinanceKeys,
  useDeleteBinanceKeys,
  useSetTestnetBinanceKeys,
  useDeleteTestnetBinanceKeys,
  useTestTestnetBinanceConnection,
  useTestBinanceConnection,
} from '../../../hooks/use-user';

export function SettingsExchangePage() {
  const { t } = useTranslation();

  // Binance Keys
  const { data: binanceStatus } = useBinanceKeyStatus();
  const { mutate: saveBinanceKeys, isPending: savingBinance } =
    useSetBinanceKeys();
  const { mutate: deleteBinanceKeys, isPending: deletingBinance } =
    useDeleteBinanceKeys();
  const [binanceForm, setBinanceForm] = useState({ apiKey: '', apiSecret: '' });

  // Binance Testnet Keys
  const { data: testnetStatus } = useTestnetBinanceKeyStatus();
  const { mutate: saveTestnetKeys, isPending: savingTestnet } =
    useSetTestnetBinanceKeys();
  const { mutate: deleteTestnetKeys, isPending: deletingTestnet } =
    useDeleteTestnetBinanceKeys();
  const [testnetForm, setTestnetForm] = useState({ apiKey: '', apiSecret: '' });
  const {
    mutate: testTestnet,
    isPending: testingTestnet,
    data: testnetTestResult,
    reset: resetTestnetTest,
  } = useTestTestnetBinanceConnection();

  // Connection tests
  const {
    mutate: testBinance,
    isPending: testingBinance,
    data: binanceTestResult,
    reset: resetBinanceTest,
  } = useTestBinanceConnection();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('settings.tabExchange')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('settings.exchangeSubtitle')}
        </p>
      </div>

      {/* Production keys */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t('settings.binanceKeys')}</h2>
            <InfoTooltip text={t('tooltips.binanceKeys')} />
          </div>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              binanceStatus?.hasKeys
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {binanceStatus?.hasKeys ? (
              <>
                <CheckCircle className="h-3 w-3" /> {t('settings.connected')}
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" /> {t('settings.disconnected')}
              </>
            )}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.apiKey')}
            </label>
            <input
              type="text"
              value={binanceForm.apiKey}
              onChange={(e) =>
                setBinanceForm((f) => ({ ...f, apiKey: e.target.value }))
              }
              placeholder="Your Binance API Key"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.apiSecret')}
            </label>
            <Input
              type="password"
              value={binanceForm.apiSecret}
              onChange={(e) =>
                setBinanceForm((f) => ({
                  ...f,
                  apiSecret: e.target.value,
                }))
              }
              placeholder="Your Binance API Secret"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Create a read+spot trading API key in{' '}
            <a
              href="https://www.binance.com/en/my/settings/api-management"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Binance API Management
            </a>
            . Do NOT enable withdrawals.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={
                savingBinance || !binanceForm.apiKey || !binanceForm.apiSecret
              }
              onClick={() =>
                saveBinanceKeys(binanceForm, {
                  onSuccess: () => {
                    setBinanceForm({ apiKey: '', apiSecret: '' });
                    resetBinanceTest();
                  },
                })
              }
            >
              {savingBinance && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('settings.saveKeys')}
            </Button>
            {binanceStatus?.hasKeys && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={testingBinance}
                  onClick={() => testBinance()}
                >
                  {testingBinance && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {testingBinance
                    ? t('settings.testing')
                    : t('settings.testConnection')}
                </Button>
                {binanceTestResult && (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      binanceTestResult.connected
                        ? 'text-emerald-500'
                        : 'text-red-500',
                    )}
                  >
                    {binanceTestResult.connected
                      ? t('settings.testSuccess')
                      : `${t('settings.testFailed')}: ${binanceTestResult.error}`}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-red-500 hover:text-red-600"
                  disabled={deletingBinance}
                  onClick={() => deleteBinanceKeys()}
                >
                  <Trash2 className="h-3 w-3" />
                  {t('settings.disconnectBinance')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Testnet keys */}
      <div className="rounded-xl border border-sky-500/20 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-4 w-4 text-sky-400" />
            <h2 className="font-semibold">
              {t('settings.binanceTestnetKeys')}
            </h2>
          </div>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              testnetStatus?.hasKeys
                ? 'bg-sky-500/10 text-sky-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {testnetStatus?.hasKeys ? (
              <>
                <CheckCircle className="h-3 w-3" /> {t('settings.connected')}
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" /> {t('settings.disconnected')}
              </>
            )}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('settings.binanceTestnetTip')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.binanceTestnetApiKey')}
            </label>
            <input
              type="text"
              value={testnetForm.apiKey}
              onChange={(e) =>
                setTestnetForm((f) => ({ ...f, apiKey: e.target.value }))
              }
              placeholder="Your Binance Testnet API Key"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.binanceTestnetApiSecret')}
            </label>
            <Input
              type="password"
              value={testnetForm.apiSecret}
              onChange={(e) =>
                setTestnetForm((f) => ({
                  ...f,
                  apiSecret: e.target.value,
                }))
              }
              placeholder="Your Binance Testnet API Secret"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={
                savingTestnet || !testnetForm.apiKey || !testnetForm.apiSecret
              }
              onClick={() =>
                saveTestnetKeys(testnetForm, {
                  onSuccess: () => {
                    setTestnetForm({ apiKey: '', apiSecret: '' });
                    resetTestnetTest();
                  },
                })
              }
            >
              {savingTestnet && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('settings.saveKeys')}
            </Button>
            {testnetStatus?.hasKeys && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={testingTestnet}
                  onClick={() => testTestnet()}
                >
                  {testingTestnet && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {testingTestnet
                    ? t('settings.testing')
                    : t('settings.testConnection')}
                </Button>
                {testnetTestResult && (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      testnetTestResult.connected
                        ? 'text-emerald-500'
                        : 'text-red-500',
                    )}
                  >
                    {testnetTestResult.connected
                      ? t('settings.testSuccess')
                      : `${t('settings.testFailed')}: ${testnetTestResult.error}`}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-red-500 hover:text-red-600"
                  disabled={deletingTestnet}
                  onClick={() => deleteTestnetKeys()}
                >
                  <Trash2 className="h-3 w-3" />
                  {t('settings.disconnectBinance')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
