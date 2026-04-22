import { useRef } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { useAuditLog } from '../../hooks/use-admin';
import { cn } from '../../lib/utils';

export function AdminAuditLogPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: auditLog = [], isLoading } = useAuditLog();

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.audit-row',
        { opacity: 0, x: -6 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.03,
          duration: 0.25,
          ease: 'power2.out',
        },
      );
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.auditLogTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.auditLogSubtitle')}
        </p>
      </div>

      {/* Log */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t('admin.auditLog')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t('admin.auditLogEntries', { count: auditLog.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : auditLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/20 py-12 gap-2">
            <Clock className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t('admin.noAuditEntries')}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.auditAction')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.auditAdmin')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('admin.auditDate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr
                    key={entry.id}
                    className="audit-row border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-primary">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.admin?.email ?? entry.adminId}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
