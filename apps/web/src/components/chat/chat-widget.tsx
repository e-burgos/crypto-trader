import { useRef, useState } from 'react';
import { BotMessageSquare, Maximize2, X, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/chat.store';
import {
  useChatSession,
  useSaveUserMessage,
  useChatStream,
  ChatCapability,
} from '../../hooks/use-chat';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { CapabilityButtons } from './capability-buttons';
import { NewSessionModal } from './llm-selector';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const PROVIDER_BADGE: Record<string, string> = {
  CLAUDE: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  OPENAI: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  GROQ: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
};

export function ChatWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isOpen, activeSessionId, toggle, close } = useChatStore();
  const [showNewSession, setShowNewSession] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // GSAP: animate FAB on mount
  useGSAP(() => {
    if (!fabRef.current) return;
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

  // GSAP: animate overlay open
  useGSAP(
    () => {
      if (!overlayRef.current || !isOpen) return;
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0, scale: 0.88, y: 20, transformOrigin: 'bottom right' },
        { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(1.4)' },
      );
    },
    { dependencies: [isOpen] },
  );

  const { data: session } = useChatSession(activeSessionId ?? '');
  const saveMessage = useSaveUserMessage(activeSessionId ?? '');
  const { streamingContent, isStreaming, startStream, stopStream } =
    useChatStream(activeSessionId ?? '');

  const handleSend = async (content: string, capability?: ChatCapability) => {
    if (!activeSessionId) {
      setShowNewSession(true);
      return;
    }
    try {
      await saveMessage.mutateAsync({ content, capability });
      startStream(content, capability);
    } catch {
      // error handled by mutation
    }
  };

  const providerBadge = session
    ? (PROVIDER_BADGE[session.provider] ??
      'bg-primary/15 text-primary ring-primary/30')
    : null;

  // Don't render the FAB/widget while the user is already on the chat page
  if (pathname.startsWith('/dashboard/chat')) return null;

  return (
    <>
      {/* ── FAB ───────────────────────────────────────────────── */}
      <button
        ref={fabRef}
        onClick={toggle}
        className={cn(
          'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl',
          'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
          'shadow-[0_4px_24px_hsl(var(--primary)/0.45)]',
          'transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_32px_hsl(var(--primary)/0.6)]',
          'active:scale-95',
          isOpen && 'scale-95 opacity-90',
          isStreaming && 'krypto-fab-pulse',
        )}
        title={t('chat.openChat', { defaultValue: 'KRYPTO AI Chat' })}
      >
        <BotMessageSquare
          className={cn(
            'h-6 w-6 transition-transform duration-300',
            isOpen && 'scale-90',
          )}
        />
        {isStreaming && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          </span>
        )}
      </button>

      {/* ── Chat overlay ──────────────────────────────────────── */}
      {isOpen && (
        <div
          ref={overlayRef}
          className={cn(
            'fixed z-50 flex flex-col',
            // Mobile: full screen with margins
            'inset-x-2 top-16 bottom-20',
            // Desktop: floating panel bottom-right
            'sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[70%]',
            'rounded-2xl',
            'shadow-[0_8px_32px_rgba(0,0,0,0.25),0_0_0_1px_hsl(var(--primary)/0.25)]',
            'bg-card border border-border',
          )}
        >
          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* ── Header ──────────────────────────────────────── */}
          <div className="relative flex items-center justify-between px-4 py-3">
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
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1',
                        providerBadge,
                      )}
                    >
                      {session.provider}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-[130px]">
                      {session.model}
                    </span>
                  </div>
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
                onClick={close}
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
            <WelcomeState
              onSend={handleSend}
              onNewSession={() => setShowNewSession(true)}
            />
          ) : (
            <>
              <div className="chat-grid-bg flex-1 overflow-hidden">
                <ChatMessages
                  messages={session?.messages ?? []}
                  streamingContent={streamingContent}
                  isStreaming={isStreaming}
                  provider={session?.provider}
                />
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
              <ChatInput
                onSend={handleSend}
                onStop={stopStream}
                isStreaming={isStreaming}
                hasMessages={(session?.messages.length ?? 0) > 0}
              />
            </>
          )}
        </div>
      )}

      {showNewSession && (
        <NewSessionModal onClose={() => setShowNewSession(false)} />
      )}
    </>
  );
}

// ── Welcome state ─────────────────────────────────────────────────────────
function WelcomeState({
  onSend,
  onNewSession,
}: {
  onSend: (content: string, capability?: ChatCapability) => void;
  onNewSession: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

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
          onSelect={(msg, cap) => onSend(msg, cap)}
          compact={false}
        />
      </div>

      <button
        onClick={onNewSession}
        className={cn(
          'welcome-el w-full rounded-xl px-5 py-3 text-sm font-semibold',
          'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground',
          'shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.6)]',
          'transition-all duration-200 hover:scale-[1.02] active:scale-95',
        )}
      >
        {t('chat.newSession', { defaultValue: 'Start new chat' })}
      </button>

      {/* Spacer inferior para centrado vertical cuando no hay overflow */}
      <div className="flex-1 min-h-4" />
    </div>
  );
}
