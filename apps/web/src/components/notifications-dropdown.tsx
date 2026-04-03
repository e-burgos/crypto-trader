import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useUnreadCount,
} from '../hooks/use-notifications';
import { cn } from '../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation, TFunction } from 'react-i18next';

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

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({
  open,
  onClose,
}: NotificationsDropdownProps) {
  const { t } = useTranslation();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: markRead } = useMarkRead();
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
      <div className="fixed top-16 right-4 z-[9999] w-80 rounded-xl border border-border bg-card shadow-2xl">
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
            notifications.slice(0, 15).map((n) => (
              <div
                key={n.id}
                className={cn(
                  'notif-item flex cursor-pointer gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                  !n.read && 'bg-primary/5',
                )}
                onClick={() => !n.read && markRead(n.id)}
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0',
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    {translateMessage(n.message, t)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
