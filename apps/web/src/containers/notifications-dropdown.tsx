import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCheck,
  Circle,
  ArrowRight,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useUnreadCount,
} from '../hooks/use-notifications';
import { cn } from '../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
    // not JSON — show raw (backward compat)
  }
  return raw;
}

const TYPE_COLORS: Record<string, string> = {
  TRADE: 'text-emerald-500',
  ALERT: 'text-amber-500',
  SYSTEM: 'text-blue-500',
  ERROR: 'text-red-500',
};

function getNotificationRoute(type: string, message: string): string {
  try {
    const parsed = JSON.parse(message) as { key?: string };
    const key = parsed?.key ?? '';
    if (key === 'tradeBuy' || key === 'tradeSell' || key === 'manualClose')
      return '/dashboard/history';
    if (key === 'stopLoss' || key === 'takeProfit')
      return '/dashboard/positions';
    if (
      key === 'agentError' ||
      key === 'agentNoLLM' ||
      key === 'agentNoTestnetKeys' ||
      key === 'agentNetworkError' ||
      key === 'agentRateLimit' ||
      key === 'agentLlmError' ||
      key === 'orderError'
    )
      return '/dashboard/config';
  } catch {
    /* empty */
  }
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

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({
  open,
  onClose,
}: NotificationsDropdownProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: markRead } = useMarkRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const unread = useUnreadCount();
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!open || !listRef.current) return;
      gsap.fromTo(
        listRef.current.querySelectorAll('.notif-item'),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out' },
      );
    },
    { scope: listRef, dependencies: [open, notifications.length] },
  );

  if (!open) return null;

  // Rendered via portal so it escapes any parent stacking context (e.g. nav z-50)
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        className="fixed top-[50px] right-4 sm:right-12 z-[9999] w-80 rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {t('notifications.title')}
            </span>
            {unread > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAllRead()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="max-h-96 overflow-y-auto divide-y divide-border"
        >
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('notifications.noNotifications')}
            </div>
          ) : (
            notifications.slice(0, 15).map((n) => {
              const route = getNotificationRoute(n.type, n.message);
              return (
                <div
                  key={n.id}
                  className={cn(
                    'notif-item group relative flex gap-3 px-4 py-3 transition-colors',
                    !n.read ? 'bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  {/* Unread dot */}
                  <span
                    className={cn(
                      'mt-1 shrink-0',
                      TYPE_COLORS[n.type] || 'text-muted-foreground',
                    )}
                  >
                    <Circle
                      className={cn(
                        'h-2 w-2',
                        !n.read ? 'fill-current' : 'opacity-0',
                      )}
                    />
                  </span>

                  {/* Content — clickable area para navegar */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      onClose();
                      navigate(route);
                    }}
                  >
                    <p className="text-sm leading-snug pr-1">
                      {translateMessage(n.message, t)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </p>
                  </button>

                  {/* Hover actions */}
                  <div className="absolute right-3 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Marcar como leída (solo si no leída) */}
                    {!n.read && (
                      <button
                        title={t('notifications.markRead')}
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/40 transition-colors"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    {/* Redirigir */}
                    <button
                      title={t('notifications.goTo')}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.read) markRead(n.id);
                        onClose();
                        navigate(route);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    {/* Eliminar */}
                    <button
                      title={t('notifications.delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5">
          <Link
            to="/dashboard/notifications"
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
          >
            {t('notifications.viewAll')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </>,
    document.body,
  );
}
