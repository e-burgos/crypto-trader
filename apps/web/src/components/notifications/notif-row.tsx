import { Check, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Notification } from '../../hooks/use-notifications';
import { cn } from '../../lib/utils';
import {
  getNotificationRoute,
  iconBg,
  translateMessage,
  timeAgo,
  routeLabel,
} from './notification-utils';
import { NotifIcon } from './notif-icon';

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
