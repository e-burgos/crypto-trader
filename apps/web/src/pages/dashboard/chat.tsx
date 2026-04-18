import { useState } from 'react';
import { BotMessageSquare } from 'lucide-react';
import {
  useChatSessions,
  useChatSession,
  useSaveUserMessage,
  useChatStream,
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
import { NewSessionModal } from '../../containers/chat/llm-selector';
import { ChatLLMOverride } from '../../containers/chat/chat-llm-override';
import { useTranslation } from 'react-i18next';

export function ChatPage() {
  const { t } = useTranslation();
  const { data: sessions = [] } = useChatSessions();
  const { activeSessionId, setActiveSession } = useChatStore();
  const [showNewSession, setShowNewSession] = useState(false);

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
  } = useChatAgent();
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

  const handleSend = async (content: string, capability?: ChatCapability) => {
    if (!activeSessionId) {
      setShowNewSession(true);
      return;
    }
    await saveMessage.mutateAsync({ content, capability });
    const { sessionProvider, sessionModel } = useChatStore.getState();
    startStream(
      content,
      capability,
      sessionProvider ?? undefined,
      sessionModel ?? undefined,
    );
  };

  const hasMessages = (session?.messages.length ?? 0) > 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session panel */}
      <ChatSessionPanel sessions={sessions} />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/70 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <BotMessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">KRYPTO</h1>
              {session ? (
                <p className="text-xs text-muted-foreground">
                  {session.provider} ·{' '}
                  <span className="font-mono">{session.model}</span>
                </p>
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
            onClick={() => setShowNewSession(true)}
            className="rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
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
            <button
              onClick={() => setShowNewSession(true)}
              className="mt-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('chat.newSession', { defaultValue: 'New session' })}
            </button>
          </div>
        ) : (
          <>
            {/* Agent selector */}
            <div className="border-b border-border px-4 py-2">
              <AgentSelector
                t={t}
                selected={selectedAgentId}
                onSelect={selectAgent}
              />
            </div>
            {/* Active agent header */}
            {activeAgentId && (
              <div className="border-b border-border/50 px-4 py-2">
                <AgentHeader
                  t={t}
                  agents={AGENTS}
                  agentId={activeAgentId}
                  routedByKrypto={!!routedAgentId && !selectedAgentId}
                  provider={session?.provider}
                  model={session?.model}
                />
              </div>
            )}
            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatMessages
                messages={session.messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                provider={session?.provider}
                streamError={streamError}
              />
            </div>
            {/* Orchestrating indicator */}
            {isOrchestrating && (
              <div className="px-4 pb-2">
                <OrchestratingIndicator t={t} step={orchestratingStep} />
              </div>
            )}
            {/* Input */}
            <ChatLLMOverride
              sessionProvider={session?.provider ?? ''}
              sessionModel={session?.model ?? ''}
            />
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

      {showNewSession && (
        <NewSessionModal onClose={() => setShowNewSession(false)} />
      )}
    </div>
  );
}
