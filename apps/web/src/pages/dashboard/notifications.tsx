import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  BotMessageSquare,
  XCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useTranslation, TFunction } from 'react-i18next';
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useUnreadCount,
  type Notification,
} from '../../hooks/use-notifications';
import { cn } from '../../lib/utils';
import { Button } from '@crypto-trader/ui';

// ── Route mapping ─────────────────────────────────────────────────────────────

/**
 * Given a raw notification message (possibly JSON), parse the key and return
 * the dashboard route the user should be taken to.
 */
function getNotificationRoute(type: string, message: string): string {
  try {
    const parsed = JSON.parse(message) as { key?: string };
    const key = parsed?.key ?? '';

    if (key === 'tradeBuy' || key === 'tradeSell' || key === 'manualClose') {
      return '/dashboard/history';
    }
    if (key === 'stopLoss' || key === 'takeProfit') {
      return '/dashboard/positions';
    }
    if (
      key === 'agentError' ||
      key === 'agentNoLLM' ||
      key === 'agentNoTestnetKeys' ||
      key === 'agentNetworkError' ||
      key === 'agentRateLimit' ||
      key === 'agentLlmError' ||
      key === 'orderError'
    ) {
      return '/dashboard/config';
    }
  } catch {
    // not JSON
  }

  // Fallback by NotificationType enum
  switch (type) {
    case 'TRADE_EXECUTED':
      return '/dashboard/history';
    case 'STOP_LOSS_TRIGGERED':
    case 'TAKE_PROFIT_HIT':
      return '/dashboard/positions';
    case 'AGENT_ERROR':
      return '/dashboard/config';
    default:
      return '/dashboard';
  }
}

// ── Icon mapping ──────────────────────────────────────────────────────────────

function NotifIcon({ type, message }: { type: string; message: string }) {
  let key = '';
  try {
    key = (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    /* empty */
  }

  if (key === 'tradeBuy') {
    return <TrendingUp className="h-5 w-5 text-emerald-500" />;
  }
  if (key === 'tradeSell' || key === 'manualClose') {
    return <TrendingDown className="h-5 w-5 text-blue-400" />;
  }
  if (key === 'stopLoss') {
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  }
  if (key === 'takeProfit') {
    return <TrendingUp className="h-5 w-5 text-amber-400" />;
  }
  if (key === 'orderError' || key === 'agentError') {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (
    key === 'agentNoLLM' ||
    key === 'agentNoTestnetKeys' ||
    key === 'agentNetworkError' ||
    key === 'agentRateLimit' ||
    key === 'agentLlmError'
  ) {
    return <ShieldAlert className="h-5 w-5 text-amber-500" />;
  }

  switch (type) {
    case 'TRADE_EXECUTED':
      return <TrendingUp className="h-5 w-5 text-emerald-500" />;
    case 'STOP_LOSS_TRIGGERED':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'TAKE_PROFIT_HIT':
      return <TrendingUp className="h-5 w-5 text-amber-400" />;
    case 'AGENT_ERROR':
      return <BotMessageSquare className="h-5 w-5 text-red-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

function iconBg(type: string, message: string): string {
  let key = '';
  try {
    key = (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    /* empty */
  }
  if (key === 'tradeBuy') return 'bg-emerald-500/10';
  if (key === 'tradeSell' || key === 'manualClose') return 'bg-blue-500/10';
  if (key === 'stopLoss' || key === 'orderError' || key === 'agentError')
    return 'bg-red-500/10';
  if (key === 'takeProfit') return 'bg-amber-500/10';
  if (
    key === 'agentNoLLM' ||
    key === 'agentNoTestnetKeys' ||
    key === 'agentNetworkError' ||
    key === 'agentRateLimit' ||
    key === 'agentLlmError'
  )
    return 'bg-amber-500/10';
  switch (type) {
    case 'STOP_LOSS_TRIGGERED':
    case 'AGENT_ERROR':
      return 'bg-red-500/10';
    case 'TAKE_PROFIT_HIT':
      return 'bg-amber-500/10';
    default:
      return 'bg-muted';
  }
}

// ── Message translation ───────────────────────────────────────────────────────

function translateMessage(raw: string, t: TFunction): string {
  try {
    const parsed = JSON.parse(raw) as { key?: string; [k: string]: unknown };
    if (parsed?.key) {
      return t(
        `notificationMessages.${parsed.key}`,
        parsed as Record<string, string>,
      ) as string;
    }
  } catch {
    /* empty */
  }
  return raw;
}

// ── Time display ──────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Route label ───────────────────────────────────────────────────────────────

function routeLabel(route: string, t: TFunction): string {
  const map: Record<string, string> = {
    '/dashboard/history': t('sidebar.tradeHistory'),
    '/dashboard/positions': t('sidebar.positions'),
    '/dashboard/config': t('sidebar.config'),
    '/dashboard': t('sidebar.overview'),
  };
  return map[route] ?? route;
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({
  n,
  onNavigate,
  onMarkRead,
  onDelete,
}: {
  n: Notification;
  onNavigate: (route: string, id: string, read: boolean) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const route = getNotificationRoute(n.type, n.message);

  return (
    <div
      className={cn(
        'group relative flex items-start gap-4 rounded-xl border border-transparent px-4 py-4',
        'transition-all duration-200 hover:border-border hover:bg-muted/40',
        !n.read && 'bg-primary/5 border-primary/10',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          iconBg(n.type, n.message),
        )}
      >
        <NotifIcon type={n.type} message={n.message} />
      </div>

      {/* Content — clickable para navegar */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => onNavigate(route, n.id, n.read)}
      >
        <p
          className={cn(
            'text-sm leading-snug pr-2',
            !n.read ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {translateMessage(n.message, t)}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground/60">
            {timeAgo(n.createdAt, t)}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span className="text-xs text-primary/70">
            {routeLabel(route, t)}
          </span>
        </div>
      </button>

      {/* Unread dot (static, top-right) */}
      {!n.read && (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Hover actions (bottom-right) */}
      <div className="absolute right-3 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!n.read && (
          <button
            title={t('notifications.markRead')}
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(n.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/40 transition-colors"
          >
            <Check className="h-3 w-3" />
          </button>
        )}
        <button
          title={t('notifications.goTo')}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(route, n.id, n.read);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        <button
          title={t('notifications.delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(n.id);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Tab filter types ──────────────────────────────────────────────────────────

type NotifTab = 'all' | 'unread' | 'trades' | 'agent';

const NOTIF_TABS: { id: NotifTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'notifications.tabAll' },
  { id: 'unread', labelKey: 'notifications.tabUnread' },
  { id: 'trades', labelKey: 'notifications.tabTrades' },
  { id: 'agent', labelKey: 'notifications.tabAgent' },
];

const TRADE_KEYS = new Set([
  'tradeBuy',
  'tradeSell',
  'manualClose',
  'stopLoss',
  'takeProfit',
]);
const AGENT_KEYS = new Set([
  'agentError',
  'agentNoLLM',
  'agentNoTestnetKeys',
  'agentNetworkError',
  'agentRateLimit',
  'agentLlmError',
  'orderError',
]);

function getMessageKey(message: string): string {
  try {
    return (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    return '';
  }
}

const PAGE_SIZE = 10;

// ── Main page ─────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();
  const { mutate: markRead } = useMarkRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const unread = useUnreadCount();

  const [tab, setTab] = useState<NotifTab>('all');
  const [page, setPage] = useState(1);

  function handleNavigate(route: string, id: string, read: boolean) {
    if (!read) markRead(id);
    navigate(route);
  }

  function handleTabChange(newTab: NotifTab) {
    setTab(newTab);
    setPage(1);
  }

  const filtered = useMemo(() => {
    switch (tab) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'trades':
        return notifications.filter((n) =>
          TRADE_KEYS.has(getMessageKey(n.message)),
        );
      case 'agent':
        return notifications.filter((n) =>
          AGENT_KEYS.has(getMessageKey(n.message)),
        );
      default:
        return notifications;
    }
  }, [notifications, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const unreadInTab = filtered.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            {t('notifications.title')}
            {unread > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('notifications.pageSubtitle')}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="ghost"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => markAllRead()}
            disabled={isMarkingAll}
          >
            <CheckCheck className="h-4 w-4" />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {NOTIF_TABS.map(({ id, labelKey }) => {
          const isActive = tab === id;
          const count =
            id === 'unread'
              ? notifications.filter((n) => !n.read).length
              : id === 'trades'
                ? notifications.filter((n) =>
                    TRADE_KEYS.has(getMessageKey(n.message)),
                  ).length
                : id === 'agent'
                  ? notifications.filter((n) =>
                      AGENT_KEYS.has(getMessageKey(n.message)),
                    ).length
                  : notifications.length;

          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(labelKey)}
              {count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                    isActive
                      ? id === 'unread'
                        ? 'bg-red-500 text-white'
                        : 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-muted/50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-muted/20 py-16 gap-3">
          <Bell className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {t('notifications.noNotifications')}
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && paginated.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
              {tab === 'unread'
                ? `${t('notifications.sectionUnread')} · ${unreadInTab}`
                : tab === 'trades'
                  ? t('notifications.tabTrades')
                  : tab === 'agent'
                    ? t('notifications.tabAgent')
                    : t('notifications.tabAll')}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {t('notifications.paginationInfo', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            </span>
          </div>

          <div className="space-y-1">
            {paginated.map((n) => (
              <NotifRow
                key={n.id}
                n={n}
                onNavigate={handleNavigate}
                onMarkRead={(id) => markRead(id)}
                onDelete={(id) => deleteNotification(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isActive = p === page;
              const isNear =
                p === 1 || p === totalPages || Math.abs(p - page) <= 1;
              if (!isNear) {
                if (p === 2 || p === totalPages - 1) {
                  return (
                    <span
                      key={p}
                      className="flex h-8 w-8 items-center justify-center text-[11px] text-muted-foreground"
                    >
                      …
                    </span>
                  );
                }
                return null;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
