import { useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAdminUsers, useToggleUserStatus } from '../../hooks/use-admin';
import { useTranslation } from 'react-i18next';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: users = [], isLoading } = useAdminUsers();
  const { mutate: toggleStatus, isPending } = useToggleUserStatus();

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.user-row',
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.usersTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.usersSubtitle')}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('admin.registeredUsers', { count: users.length })}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('common.role')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Joined
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="user-row border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        u.role === 'ADMIN'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        u.isActive
                          ? 'text-emerald-500'
                          : 'text-muted-foreground',
                      )}
                    >
                      {u.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3" />{' '}
                          {t('settings.active')}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />{' '}
                          {t('settings.inactive')}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        toggleStatus({ id: u.id, isActive: !u.isActive })
                      }
                      className={cn(
                        'text-xs',
                        u.isActive
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-emerald-500 hover:text-emerald-600',
                      )}
                    >
                      {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : u.isActive ? (
                        t('admin.deactivate')
                      ) : (
                        t('admin.activate')
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
