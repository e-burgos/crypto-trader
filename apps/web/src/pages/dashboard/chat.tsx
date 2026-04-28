import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BotMessageSquare, PanelLeft, X } from 'lucide-react';
import {
  useChatSessions,
  useChatSession,
  useSaveUserMessage,
  useChatStream,
  useCreateChatSession,
  chatKeys,
} from '../../hooks/use-chat';
import type { ChatCapability } from '@crypto-trader/ui';
import { useChatAgent } from '../../hooks/use-chat-agent';
import { useChatStore } from '../../store/chat.store';
import { ChatMessages } from '../../containers/chat/chat-messages';
import {
  ChatInput,
  CapabilityButtons,
  AgentSelector,
  AgentHeader,
  OrchestratingIndicator,
  AGENTS,
} from '@crypto-trader/ui';
import { ChatSessionPanel } from '../../containers/chat/chat-session-panel';
import { useTranslation } from 'react-i18next';

export function ChatPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: sessions = [] } = useChatSessions();
  const { activeSessionId } = useChatStore();
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  const { data: session } = useChatSession(activeSessionId ?? '');
  const saveMessage = useSaveUserMessage(activeSessionId ?? '');
  const {
    selectedAgentId,
    routedAgentId,
    isOrchestrating,
    orchestratingStep,
    activeAgentId,
    selectAgent,
    handleRoutingEvent,
    handleOrchestratingEvent,
    handleStreamDone,
  } = useChatAgent(session?.agentId, activeSessionId);
  const {
    streamingContent,
    isStreaming,
    streamError,
    startStream,
    stopStream,
  } = useChatStream(activeSessionId ?? '', {
    onRouting: handleRoutingEvent,
    onOrchestrating: handleOrchestratingEvent,
    onDone: handleStreamDone,
  });
  const createSession = useCreateChatSession();

  // Pending message ref: when creating a new session, we store the message here
  // and defer save+stream until the hooks re-render with the correct sessionId
  const pendingMessage = useRef<{
    content: string;
    capability?: ChatCapability;
  } | null>(null);

  // Effect: flush pending message once hooks have the correct session
  useEffect(() => {
    if (pendingMessage.current && activeSessionId) {
      const { content, capability } = pendingMessage.current;
      pendingMessage.current = null;
      saveMessage.mutateAsync({ content, capability });
      startStream(content, capability, selectedAgentId ?? undefined);
    }
  }, [activeSessionId, saveMessage, startStream, selectedAgentId]);

  const handleSend = async (content: string, capability?: ChatCapability) => {
    if (activeSessionId) {
      // Session already exists — hooks have correct sessionId
      await saveMessage.mutateAsync({ content, capability });
      startStream(content, capability, selectedAgentId ?? undefined);
    } else {
      // No session yet — create one, then defer save+stream to next render
      try {
        const newSession = await createSession.mutateAsync({
          title: content.slice(0, 60) || 'New Chat',
          agentId: selectedAgentId ?? undefined,
        });
        // Seed the session cache so the UI transitions to session view immediately
        // (without waiting for the query fetch to resolve)
        qc.setQueryData(chatKeys.session(newSession.id), {
          ...newSession,
          messages: [],
        });
        pendingMessage.current = { content, capability };
        setActiveSession(newSession.id);
      } catch {
        return;
      }
    }
  };

  const hasMessages = (session?.messages.length ?? 0) > 0;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const displayAgent = activeAgentId
    ? AGENTS.find((a) => a.id === activeAgentId)
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Desktop sidebar (always visible) ── */}
      <div className="hidden md:flex h-full">
        <ChatSessionPanel sessions={sessions} />
      </div>

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar panel (slide-in from left) ── */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full">
          {/* Close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
          <ChatSessionPanel
            sessions={sessions}
            onSelect={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/70 px-4 py-4 backdrop-blur-md gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: toggle sidebar button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Open conversations"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BotMessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground">KRYPTO</h1>
              {session ? (
                <div className="flex items-center gap-1.5">
                  {displayAgent ? (
                    <span className="text-xs font-medium text-primary truncate">
                      {displayAgent.name}
                    </span>
                  ) : null}
                  {session.model && (
                    <span className="text-xs text-muted-foreground truncate">
                      {displayAgent ? '·' : ''}{' '}
                      <span className="font-mono">{session.model}</span>
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('chat.subtitle', {
                    defaultValue: 'Your internal AI trading agent',
                  })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveSession(null)}
            className="shrink-0 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            + {t('chat.newSession', { defaultValue: 'New session' })}
          </button>
        </div>

        {/* Empty state */}
        {!activeSessionId || !session ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BotMessageSquare className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {t('chat.welcomeTitle', { defaultValue: "Hi, I'm KRYPTO" })}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t('chat.welcomeDesc', {
                  defaultValue:
                    'Your internal trading agent. I remember my past decisions and can help you understand the platform, analyze markets, guide trades, or teach you about blockchain.',
                })}
              </p>
            </div>
            <CapabilityButtons
              t={t}
              onSelect={(msg, cap) => handleSend(msg, cap)}
              compact={false}
            />
          </div>
        ) : (
          <>
            {/* Agent selector + orchestrating status */}
            <div className="border-b border-border px-4 py-2 space-y-2">
              <AgentSelector
                t={t}
                selected={selectedAgentId}
                onSelect={selectAgent}
              />
              {isOrchestrating && (
                <OrchestratingIndicator t={t} step={orchestratingStep} />
              )}
            </div>
            {/* Active agent header */}
            {activeAgentId && (
              <div className="border-b border-border/50 px-4 py-2">
                <AgentHeader
                  t={t}
                  agents={AGENTS}
                  agentId={activeAgentId}
                  routedByKrypto={!!routedAgentId && !selectedAgentId}
                  provider={session?.provider ?? undefined}
                  model={session?.model ?? undefined}
                />
              </div>
            )}
            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatMessages
                messages={session.messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                provider={session?.provider ?? undefined}
                streamError={streamError}
              />
            </div>
            {/* Input */}
            <ChatInput
              t={t}
              onSend={handleSend}
              onStop={stopStream}
              isStreaming={isStreaming || isOrchestrating}
              hasMessages={hasMessages}
            />
          </>
        )}
      </div>
    </div>
  );
}
