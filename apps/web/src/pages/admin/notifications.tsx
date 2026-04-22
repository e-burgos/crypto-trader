import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useUnreadCount,
} from '../../hooks/use-notifications';
import { cn } from '../../lib/utils';
import { Button } from '@crypto-trader/ui';
import {
  NotifRow,
  getMessageKey,
  NOTIF_TABS,
  PAGE_SIZE,
  type NotifTab,
} from '../../components/notifications';

export function AdminNotificationsPage() {
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
    <div className="mx-auto max-w-2xl space-y-5">
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
            {t('admin.notificationsSubtitle')}
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

      {/* Simplified tabs: All / Unread */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {(['all', 'unread'] as const).map((id) => {
          const isActive = tab === id;
          const count =
            id === 'unread'
              ? notifications.filter((n) => !n.read).length
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
              {id === 'all'
                ? t('notifications.tabAll')
                : t('notifications.tabUnread')}
              {count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                    isActive && id === 'unread'
                      ? 'bg-red-500 text-white'
                      : isActive
                        ? 'bg-primary/15 text-primary'
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
