import { useState } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatSessionSummary, useDeleteChatSession } from '../../hooks/use-chat';
import { useChatStore } from '../../store/chat.store';
import { useTranslation } from 'react-i18next';

const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  OPENAI: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  GROQ: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

function groupByDate(
  sessions: ChatSessionSummary[],
): Record<string, ChatSessionSummary[]> {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterday = today - 86_400_000;
  const thisWeek = today - 6 * 86_400_000;

  const groups: Record<string, ChatSessionSummary[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Older: [],
  };

  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    if (t >= today) groups['Today'].push(s);
    else if (t >= yesterday) groups['Yesterday'].push(s);
    else if (t >= thisWeek) groups['This week'].push(s);
    else groups['Older'].push(s);
  }

  return groups;
}

interface ChatSessionPanelProps {
  sessions: ChatSessionSummary[];
  compact?: boolean;
}

export function ChatSessionPanel({ sessions, compact }: ChatSessionPanelProps) {
  const { t } = useTranslation();
  const { activeSessionId, setActiveSession } = useChatStore();
  const deleteSession = useDeleteChatSession();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groups = groupByDate(sessions);

  return (
    <>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card',
          compact ? 'h-full w-full' : 'h-full w-64 shrink-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <span className="text-sm font-semibold text-foreground/80">
            {t('chat.sessions', { defaultValue: 'Conversations' })}
          </span>
          <button
            onClick={() => setActiveSession(null)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            title={t('chat.newSession', { defaultValue: 'New session' })}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p>
                {t('chat.noSessions', {
                  defaultValue: 'No conversations yet.',
                })}
              </p>
              <button
                onClick={() => setActiveSession(null)}
                className="text-primary hover:underline"
              >
                {t('chat.startFirst', {
                  defaultValue: 'Start your first chat',
                })}
              </button>
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) =>
              items.length === 0 ? null : (
                <div key={group} className="mb-3">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((session) => (
                      <li key={session.id} className="group relative">
                        <button
                          onClick={() => setActiveSession(session.id)}
                          className={cn(
                            'w-full rounded-lg px-2 py-2 text-left text-xs transition-colors',
                            activeSessionId === session.id
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground/70 hover:bg-foreground/10 hover:text-foreground',
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-medium">
                              {session.title}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded border px-1 text-[9px] font-semibold',
                                session.provider
                                  ? (PROVIDER_COLORS[session.provider] ??
                                      'bg-muted text-muted-foreground border-border')
                                  : 'bg-muted text-muted-foreground border-border',
                              )}
                            >
                              {session.provider ?? 'Auto'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {session._count.messages}{' '}
                            {t('chat.messages', { defaultValue: 'messages' })}
                          </p>
                        </button>
                        {/* Delete button – appears on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(session.id);
                          }}
                          className="absolute bottom-1 right-1.5 hidden rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400 group-hover:flex"
                          title={t('chat.deleteSession', {
                            defaultValue: 'Delete',
                          })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}
        </div>
      </aside>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-border bg-card p-5 shadow-xl">
            <p className="mb-4 text-sm text-foreground">
              {t('chat.deleteConfirm', {
                defaultValue:
                  'Delete this conversation? This cannot be undone.',
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={async () => {
                  await deleteSession.mutateAsync(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20"
              >
                {t('common.delete', { defaultValue: 'Delete' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
