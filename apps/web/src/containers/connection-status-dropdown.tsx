import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wifi, WifiOff, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import {
  useBinanceKeyStatus,
  useLLMKeys,
  useTestnetBinanceKeyStatus,
} from '../hooks/use-user';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';

// ── Internet connectivity hook ────────────────────────────────────────────────

function useInternetStatus(): ConnStatus {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Double-check with a real fetch in case navigator.onLine is wrong
    if (!navigator.onLine) {
      fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' })
        .then(() => setOnline(true))
        .catch(() => {
          /* intentional: swallow offline check */
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online ? 'ok' : 'error';
}

// ── API ping ──────────────────────────────────────────────────────────────────

function useApiPing() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<{ status: string }>({
    queryKey: ['health', 'api'],
    queryFn: () => api.get('/health'),
    staleTime: 30_000,
    retry: 1,
    enabled: isAuthenticated,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnStatus = 'ok' | 'warning' | 'error' | 'loading';

interface Connection {
  id: string;
  label: string;
  sublabel?: string;
  status: ConnStatus;
  href: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusDot(s: ConnStatus) {
  const base = 'h-2 w-2 rounded-full shrink-0';
  if (s === 'ok') return <span className={cn(base, 'bg-emerald-500')} />;
  if (s === 'warning')
    return <span className={cn(base, 'bg-amber-400 animate-pulse')} />;
  if (s === 'error')
    return <span className={cn(base, 'bg-red-500 animate-pulse')} />;
  return <span className={cn(base, 'bg-muted-foreground/30 animate-pulse')} />;
}

function overallStatus(conns: Connection[]): ConnStatus {
  if (conns.some((c) => c.status === 'loading')) return 'loading';
  if (conns.some((c) => c.status === 'error')) return 'error';
  if (conns.some((c) => c.status === 'warning')) return 'warning';
  return 'ok';
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConnectionStatusDropdown() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();

  const internetStatus = useInternetStatus();
  const {
    data: apiPing,
    isLoading: apiLoading,
    isError: apiError,
  } = useApiPing();

  // If the API responds, internet is definitely working regardless of navigator.onLine
  const effectiveInternetStatus: ConnStatus =
    apiPing?.status === 'ok' ? 'ok' : internetStatus;
  const { data: binance, isLoading: binanceLoading } = useBinanceKeyStatus();
  const { data: testnet, isLoading: testnetLoading } =
    useTestnetBinanceKeyStatus();
  const { data: llmKeys, isLoading: llmLoading } = useLLMKeys();

  function apiStatus(): ConnStatus {
    if (apiLoading) return 'loading';
    if (apiError) return 'error';
    return apiPing?.status === 'ok' ? 'ok' : 'ok';
  }

  function binanceStatus(): ConnStatus {
    if (binanceLoading) return 'loading';
    if (!binance?.hasKeys) return 'warning';
    return binance.isActive ? 'ok' : 'error';
  }

  function testnetStatus(): ConnStatus {
    if (testnetLoading) return 'loading';
    if (!testnet?.hasKeys) return 'warning';
    return testnet.isActive ? 'ok' : 'error';
  }

  function llmStatus(): ConnStatus {
    if (llmLoading) return 'loading';
    if (!llmKeys || llmKeys.length === 0) return 'warning';
    return llmKeys.some((k) => k.isActive) ? 'ok' : 'error';
  }

  const activeCount = llmKeys?.filter((k) => k.isActive).length ?? 0;

  const connections: Connection[] = [
    {
      id: 'internet',
      label: t('connections.internet'),
      sublabel: t('connections.internetSub'),
      status: effectiveInternetStatus,
      href: '/dashboard',
    },
    {
      id: 'api',
      label: t('connections.api'),
      sublabel: t('connections.apiSub'),
      status: apiStatus(),
      href: '/dashboard',
    },
    {
      id: 'binance',
      label: t('connections.binanceLive'),
      sublabel: t('connections.binanceLiveSub'),
      status: binanceStatus(),
      href: '/dashboard/settings?tab=exchange',
    },
    {
      id: 'testnet',
      label: t('connections.binanceTestnet'),
      sublabel: t('connections.binanceTestnetSub'),
      status: testnetStatus(),
      href: '/dashboard/settings?tab=exchange',
    },
    {
      id: 'llm',
      label: t('connections.llmProviders'),
      sublabel:
        activeCount > 0
          ? t('connections.llmConnectedCount', { count: activeCount })
          : t('connections.llmSub'),
      status: llmStatus(),
      href: '/dashboard/settings?tab=ai',
    },
  ];

  const overall = overallStatus(connections);

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ['health'] });
    qc.invalidateQueries({ queryKey: ['user', 'binance-status'] });
    qc.invalidateQueries({ queryKey: ['user', 'binance-testnet-status'] });
    qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
  }

  const statusLabel: Record<ConnStatus, string> = {
    ok: t('connections.statusOk'),
    warning: t('connections.statusWarning'),
    error: t('connections.statusError'),
    loading: t('connections.statusLoading'),
  };

  const connStatusLabel: Record<ConnStatus, string> = {
    ok: t('connections.connOk'),
    warning: t('connections.connWarning'),
    error: t('connections.connError'),
    loading: t('connections.connLoading'),
  };

  return (
    <div className="relative border border-border rounded-md">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1.5 rounded-md px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={t('connections.title')}
      >
        {overall === 'error' || overall === 'warning' ? (
          <WifiOff className="h-4 w-4" />
        ) : (
          <Wifi className="h-4 w-4" />
        )}
        {/* overall dot */}
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-card',
            overall === 'ok' && 'bg-emerald-500',
            overall === 'warning' && 'bg-amber-400 animate-pulse',
            overall === 'error' && 'bg-red-500 animate-pulse',
            overall === 'loading' && 'bg-muted-foreground/40 animate-pulse',
          )}
        />
      </button>

      {/* Dropdown */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
            <div
              className="absolute z-50 w-72 rounded-xl border border-border bg-card shadow-xl"
              style={
                window.innerWidth < 640
                  ? {
                      top:
                        (buttonRef.current?.getBoundingClientRect().bottom ??
                          0) + 6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }
                  : {
                      top:
                        (buttonRef.current?.getBoundingClientRect().bottom ??
                          0) + 6,
                      right:
                        window.innerWidth -
                        (buttonRef.current?.getBoundingClientRect().right ?? 0),
                    }
              }
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    {t('connections.title')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      overall === 'ok' && 'text-emerald-500',
                      overall === 'warning' && 'text-amber-400',
                      overall === 'error' && 'text-red-500',
                      overall === 'loading' && 'text-muted-foreground',
                    )}
                  >
                    {statusLabel[overall]}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={t('connections.refresh')}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Connection rows */}
              <div className="py-1.5">
                {connections.map((conn) => (
                  <Link
                    key={conn.id}
                    to={conn.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                  >
                    {statusDot(conn.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conn.label}
                      </p>
                      {conn.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conn.sublabel}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'text-xs',
                          conn.status === 'ok' && 'text-emerald-500',
                          conn.status === 'warning' && 'text-amber-400',
                          conn.status === 'error' && 'text-red-500',
                          conn.status === 'loading' && 'text-muted-foreground',
                        )}
                      >
                        {connStatusLabel[conn.status]}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-3">
                <Link
                  to="/dashboard/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('connections.manageKeys')}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
