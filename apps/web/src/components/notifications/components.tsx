import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  BotMessageSquare,
  XCircle,
  Check,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useTranslation, TFunction } from 'react-i18next';
import { type Notification } from '../../hooks/use-notifications';
import { cn } from '../../lib/utils';

/**
 * Given a raw notification message (possibly JSON), parse the key and return
 * the dashboard route the user should be taken to.
 */
export function getNotificationRoute(type: string, message: string): string {
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

export function NotifIcon({
  type,
  message,
}: {
  type: string;
  message: string;
}) {
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

export function iconBg(type: string, message: string): string {
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

export function translateMessage(raw: string, t: TFunction): string {
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

export function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Route label ───────────────────────────────────────────────────────────────

export function routeLabel(route: string, t: TFunction): string {
  const map: Record<string, string> = {
    '/dashboard/history': t('sidebar.tradeHistory'),
    '/dashboard/positions': t('sidebar.positions'),
    '/dashboard/config': t('sidebar.config'),
    '/dashboard': t('sidebar.overview'),
  };
  return map[route] ?? route;
}

// ── Notification row ──────────────────────────────────────────────────────────

export function NotifRow({
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

export type NotifTab = 'all' | 'unread' | 'trades' | 'agent';

export const NOTIF_TABS: { id: NotifTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'notifications.tabAll' },
  { id: 'unread', labelKey: 'notifications.tabUnread' },
  { id: 'trades', labelKey: 'notifications.tabTrades' },
  { id: 'agent', labelKey: 'notifications.tabAgent' },
];

export const TRADE_KEYS = new Set([
  'tradeBuy',
  'tradeSell',
  'manualClose',
  'stopLoss',
  'takeProfit',
]);
export const AGENT_KEYS = new Set([
  'agentError',
  'agentNoLLM',
  'agentNoTestnetKeys',
  'agentNetworkError',
  'agentRateLimit',
  'agentLlmError',
  'orderError',
]);

export function getMessageKey(message: string): string {
  try {
    return (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    return '';
  }
}

export const PAGE_SIZE = 10;

// ── Main page ─────────────────────────────────────────────────────────────────
