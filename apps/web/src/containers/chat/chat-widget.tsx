import { useRef, useState, useCallback } from 'react';
import {
  BotMessageSquare,
  Maximize2,
  X,
  Sparkles,
  Plus,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/chat.store';
import {
  useChatSession,
  useSaveUserMessage,
  useChatStream,
  useSelectOption,
  useCreateChatSession,
} from '../../hooks/use-chat';
import type { ChatCapability } from '@crypto-trader/ui';
import type { InlineOption } from '../../hooks/use-chat';
import { useChatAgent } from '../../hooks/use-chat-agent';
import { useLLMKeys } from '../../hooks/use-user';
import { useAuthStore } from '../../store/auth.store';
import { useHasActiveLLMKey } from '../../components/llm-key-guard';
import { ChatMessages } from './chat-messages';
import { ChatQuickActions } from './chat-quick-actions';
import { ChatInlineOptions } from './chat-inline-options';
import {
  ChatInput,
  CapabilityButtons,
  AgentSelector,
  AgentHeader,
  OrchestratingIndicator,
  AGENTS,
} from '@crypto-trader/ui';
import type { AgentId } from '@crypto-trader/ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export function ChatWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { hasKey: hasActiveLLMKey } = useHasActiveLLMKey();
  const { isOpen, activeSessionId, toggle, close, setActiveSession } =
    useChatStore();

  const overlayRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number>(0);

  // Mobile sheet height: 'partial' = 88vh, 'full' = 100vh
  const [sheetSize, setSheetSize] = useState<'partial' | 'full'>('partial');

  // Reset to partial whenever panel closes
  const handleClose = useCallback(() => {
    setSheetSize('partial');
    close();
  }, [close]);

  // Animate slide-down on mobile before closing
  const animateClose = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop && overlayRef.current) {
      gsap.to(overlayRef.current, {
        y: '100%',
        duration: 0.3,
        ease: 'power3.in',
        onComplete: handleClose,
      });
    } else {
      handleClose();
    }
  }, [handleClose]);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleDragEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    if (delta < -40) {
      // Swiped up → fullscreen
      setSheetSize('full');
    } else if (delta > 40) {
      // Swiped down → animate close
      animateClose();
    }
  };

  // GSAP: animate FAB on mount
  useGSAP(() => {
    if (!fabRef.current || !isAuthenticated) return;
    gsap.fromTo(
      fabRef.current,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(2)',
        delay: 0.3,
        clearProps: 'scale,opacity',
      },
    );
  });

  // GSAP: slide from right on desktop, slide up from bottom on mobile
  useGSAP(
    () => {
      if (!overlayRef.current || !isOpen || !isAuthenticated) return;
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (isDesktop) {
        gsap.fromTo(
          overlayRef.current,
          { x: 420, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.3,
            ease: 'power3.out',
            clearProps: 'x,opacity',
          },
        );
      } else {
        gsap.fromTo(
          overlayRef.current,
          { y: '100%' },
          { y: 0, duration: 0.35, ease: 'power3.out', clearProps: 'y' },
        );
      }
    },
    { dependencies: [isOpen] },
  );

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
  } = useChatAgent(session?.agentId);
  const {
    streamingContent,
    isStreaming,
    streamError,
    quickActions,
    inlineOptions,
    startStream,
    stopStream,
  } = useChatStream(activeSessionId ?? '', {
    onRouting: handleRoutingEvent,
    onOrchestrating: handleOrchestratingEvent,
    onDone: handleStreamDone,
  });
  const selectOption = useSelectOption(activeSessionId ?? '');
  const createSession = useCreateChatSession();

  // All hooks called above — safe to early-return now
  if (!isAuthenticated) return null;

  // Hide chat entirely if no active LLM key
  if (!hasActiveLLMKey) return null;

  const handleSend = async (content: string, capability?: ChatCapability) => {
    let sid = activeSessionId;
    // Auto-create session if none exists
    if (!sid) {
      try {
        const newSession = await createSession.mutateAsync({
          title: content.slice(0, 60) || 'New Chat',
        });
        sid = newSession.id;
        setActiveSession(sid);
      } catch {
        return; // error handled by mutation toast
      }
    }
    try {
      await saveMessage.mutateAsync({ content, capability });
      startStream(content, capability, selectedAgentId ?? undefined);
    } catch {
      // error handled by mutation
    }
  };

  // Agent display name for header
  const displayAgent = activeAgentId
    ? AGENTS.find((a) => a.id === activeAgentId)
    : null;

  // Don't render the FAB/widget while the user is already on the chat page
  if (pathname.startsWith('/dashboard/chat')) return null;

  return (
    <>
      {/* ── FAB — visible only when chat is closed ─────────── */}
      {!isOpen && (
        <button
          ref={fabRef}
          onClick={toggle}
          className={cn(
            'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
            'shadow-[0_4px_24px_hsl(var(--primary)/0.45)]',
            'transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_32px_hsl(var(--primary)/0.6)]',
            'active:scale-95',
            isStreaming && 'krypto-fab-pulse',
          )}
          title={t('chat.openChat', { defaultValue: 'KRYPTO AI Chat' })}
        >
          <BotMessageSquare className="h-6 w-6" />
          {isStreaming && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            </span>
          )}
        </button>
      )}

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={animateClose}
        />
      )}

      {/* ── Chat panel: sidebar (desktop) / bottom-sheet (mobile) ── */}
      {isOpen && (
        <div
          ref={overlayRef}
          className={cn(
            'fixed z-50 flex flex-col bg-card',
            // Mobile: bottom sheet with dynamic height
            'inset-x-0 bottom-0 rounded-t-2xl border-t border-border',
            'shadow-[0_-8px_40px_rgba(0,0,0,0.3)]',
            sheetSize === 'full' ? 'h-screen rounded-t-none' : 'h-[88vh]',
            'transition-[height,border-radius] duration-300 ease-in-out',
            // Desktop: full-height right sidebar
            'md:inset-y-0 md:inset-x-auto md:right-0 md:bottom-auto md:h-full md:w-[400px]',
            'md:rounded-none md:border-t-0 md:border-l md:border-border',
            'md:shadow-[-8px_0_32px_rgba(0,0,0,0.15)]',
            'md:transition-none',
          )}
        >
          {/* Mobile drag handle — swipe up = fullscreen, swipe down = close */}
          <div
            className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0 touch-none select-none"
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
          >
            <div
              className={cn(
                'h-1 w-10 rounded-full transition-colors duration-150',
                sheetSize === 'full'
                  ? 'bg-primary/50'
                  : 'bg-border/80 hover:bg-primary/40',
              )}
            />
          </div>

          {/* Top accent line — desktop only */}
          <div className="hidden md:block h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* ── Header ──────────────────────────────────────── */}
          <div className="relative flex items-center justify-between px-4 py-3 bg-card shrink-0">
            {/* Subtle radial glow behind header */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/8 to-transparent" />

            <div className="relative flex items-center gap-3">
              {/* Avatar */}
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 shadow-[0_0_14px_hsl(var(--primary)/0.3)]">
                <BotMessageSquare className="h-5 w-5 text-primary" />
                {/* Online dot */}
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold tracking-wide text-foreground">
                    KRYPTO
                  </p>
                  <Sparkles className="h-3 w-3 text-primary/60" />
                </div>
                {session ? (
                  <p className="text-[10px] text-muted-foreground/60">
                    {displayAgent
                      ? t('chat.activeAgent', {
                          defaultValue: '{{name}} active',
                          name: displayAgent.name,
                        })
                      : t('chat.resolvingAgent', {
                          defaultValue: 'Resolving agent…',
                        })}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/60">
                    AI Trading Agent
                  </p>
                )}
              </div>
            </div>

            <div className="relative flex items-center gap-0.5">
              <button
                onClick={() => {
                  setActiveSession(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                title={t('chat.newSession', {
                  defaultValue: 'New session',
                })}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  navigate('/dashboard/chat');
                  close();
                }}
                className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                title={t('chat.openFullscreen', {
                  defaultValue: 'Open fullscreen',
                })}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={animateClose}
                className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* ── Body ────────────────────────────────────────── */}
          {!activeSessionId ? (
            <WelcomeState onSend={handleSend} />
          ) : (
            <>
              {/* Agent selector — pick which sub-agent to use */}
              <div className="px-3 py-2 border-b border-border/50 space-y-2">
                <AgentSelector
                  t={t}
                  selected={selectedAgentId}
                  onSelect={selectAgent}
                />
                {isOrchestrating && (
                  <OrchestratingIndicator t={t} step={orchestratingStep} />
                )}
              </div>

              {/* Agent header inside the chat area */}
              {activeAgentId && (
                <div className="px-4 py-2 border-b border-border/50">
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
              <div className="chat-grid-bg flex-1 overflow-hidden">
                <ChatMessages
                  messages={session?.messages ?? []}
                  streamingContent={streamingContent}
                  isStreaming={isStreaming}
                  provider={session?.provider ?? undefined}
                  streamError={streamError}
                />
                {/* D: Quick actions / Inline options from agent response */}
                {!isStreaming && quickActions && (
                  <ChatQuickActions
                    actions={quickActions}
                    onTransferAgent={(target) => selectAgent(target as AgentId)}
                  />
                )}
                {!isStreaming && inlineOptions && (
                  <ChatInlineOptions
                    options={inlineOptions}
                    onSelect={(opt: InlineOption) => {
                      selectOption.mutate({
                        optionId: opt.id,
                        value: opt.value,
                      });
                      // Re-send as user message to continue the conversation
                      handleSend(opt.value);
                    }}
                    disabled={selectOption.isPending}
                  />
                )}
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
              <ChatInput
                t={t}
                onSend={handleSend}
                onStop={stopStream}
                isStreaming={isStreaming || isOrchestrating}
                hasMessages={(session?.messages.length ?? 0) > 0}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Welcome state ─────────────────────────────────────────────────────────
function WelcomeState({
  onSend,
}: {
  onSend: (content: string, capability?: ChatCapability) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: llmKeys = [] } = useLLMKeys();
  const hasActiveKeys = llmKeys.some((k) => k.isActive);

  useGSAP(
    () => {
      gsap.fromTo(
        '.welcome-el',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.08 },
      );
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col items-center gap-5 px-6 py-6 text-center overflow-y-auto scroll-smooth"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--primary)/0.3) transparent',
      }}
    >
      {/* Spacer para centrar verticalmente cuando no hay overflow */}
      <div className="flex-1 min-h-4" />

      {/* Logo glow */}
      <div className="welcome-el relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-3xl bg-primary/25 blur-2xl animate-pulse" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_32px_hsl(var(--primary)/0.45)]">
          <BotMessageSquare className="h-10 w-10 text-primary" />
        </div>
      </div>

      <div className="welcome-el space-y-1.5">
        <h3 className="text-lg font-bold tracking-wide">
          {t('chat.welcomeTitle', { defaultValue: "Hi, I'm KRYPTO" })}
        </h3>
        <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-[300px] mx-auto">
          {t('chat.welcomeDesc', {
            defaultValue:
              'Your internal trading agent. Ask me anything about the platform, markets, or blockchain.',
          })}
        </p>
      </div>

      <div className="welcome-el w-full">
        <CapabilityButtons
          t={t}
          onSelect={(msg, cap) => onSend(msg, cap)}
          compact={false}
        />
      </div>

      {!hasActiveKeys ? (
        <div className="welcome-el w-full space-y-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            {t('chat.noLlmKeysWarning', {
              defaultValue:
                'Configura al menos un proveedor LLM en Ajustes para poder chatear.',
            })}
          </div>
          <button
            onClick={() => navigate('/dashboard/settings?tab=modelos')}
            className={cn(
              'w-full rounded-xl px-5 py-3 text-sm font-semibold',
              'bg-gradient-to-r from-amber-500 to-amber-500/80 text-white',
              'shadow-[0_0_20px_hsl(38,92%,50%,0.3)]',
              'transition-all duration-200 hover:scale-[1.02] active:scale-95',
            )}
          >
            <Settings className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            {t('chat.goToSettings', { defaultValue: 'Ir a Ajustes' })}
          </button>
        </div>
      ) : (
        <button
          onClick={() =>
            onSend(
              t('chat.defaultGreeting', { defaultValue: 'Hello, KRYPTO!' }),
            )
          }
          className={cn(
            'welcome-el w-full rounded-xl px-5 py-3 text-sm font-semibold',
            'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground',
            'shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.6)]',
            'transition-all duration-200 hover:scale-[1.02] active:scale-95',
          )}
        >
          {t('chat.newSession', { defaultValue: 'Start new chat' })}
        </button>
      )}

      {/* Spacer inferior para centrado vertical cuando no hay overflow */}
      <div className="flex-1 min-h-4" />
    </div>
  );
}
