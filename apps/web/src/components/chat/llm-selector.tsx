import { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useChatLLMOptions,
  useCreateChatSession,
  LLMOption,
} from '../../hooks/use-chat';
import { useChatStore } from '../../store/chat.store';
import { useTranslation } from 'react-i18next';

interface LLMSelectorProps {
  onCreated?: (sessionId: string) => void;
  /** If true, renders as a compact inline row instead of a modal */
  inline?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: 'text-orange-400',
  OPENAI: 'text-emerald-400',
  GROQ: 'text-violet-400',
};

function providerColor(provider: string) {
  return PROVIDER_COLORS[provider] ?? 'text-muted-foreground';
}

export function LLMSelector({ onCreated, inline }: LLMSelectorProps) {
  const { t } = useTranslation();
  const { data: options = [], isLoading } = useChatLLMOptions();
  const createSession = useCreateChatSession();
  const setActive = useChatStore((s) => s.setActiveSession);

  const [selectedProvider, setSelectedProvider] = useState<LLMOption | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setProviderOpen(false);
        setModelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleProviderSelect = (opt: LLMOption) => {
    setSelectedProvider(opt);
    setSelectedModel(opt.models[0] ?? '');
    setProviderOpen(false);
  };

  const handleCreate = async () => {
    if (!selectedProvider || !selectedModel) return;
    try {
      const session = await createSession.mutateAsync({
        provider: selectedProvider.provider,
        model: selectedModel,
      });
      setActive(session.id);
      onCreated?.(session.id);
    } catch {
      // toast already shown by mutation onError
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {t('chat.loadingProviders', {
          defaultValue: 'Loading AI providers...',
        })}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
        <Bot className="mx-auto mb-2 h-6 w-6 opacity-40" />
        <p>
          {t('chat.noCredentials', {
            defaultValue: 'No AI providers configured.',
          })}
        </p>
        <a href="/dashboard/settings" className="text-primary hover:underline">
          {t('chat.goToSettings', { defaultValue: 'Go to Settings → AI tab' })}
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center gap-2', !inline && 'flex-col')}
    >
      {/* Provider picker */}
      <div className="relative">
        <button
          onClick={() => {
            setProviderOpen((p) => !p);
            setModelOpen(false);
          }}
          className="flex min-w-[140px] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          {selectedProvider ? (
            <span
              className={cn(
                'font-medium',
                providerColor(selectedProvider.provider),
              )}
            >
              {selectedProvider.label}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('chat.selectProvider', { defaultValue: 'Select AI...' })}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {providerOpen && (
          <ul className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {options.map((opt) => (
              <li key={opt.provider}>
                <button
                  onClick={() => handleProviderSelect(opt)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className={cn(providerColor(opt.provider))}>
                    {opt.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Model picker */}
      {selectedProvider && (
        <div className="relative">
          <button
            onClick={() => {
              setModelOpen((p) => !p);
              setProviderOpen(false);
            }}
            className="flex min-w-[180px] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <span className="truncate font-mono text-xs">{selectedModel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
          {modelOpen && (
            <ul className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
              {selectedProvider.models.map((m) => (
                <li key={m}>
                  <button
                    onClick={() => {
                      setSelectedModel(m);
                      setModelOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left font-mono text-xs hover:bg-accent"
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={
          !selectedProvider || !selectedModel || createSession.isPending
        }
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          selectedProvider && selectedModel
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'cursor-not-allowed bg-muted text-muted-foreground/40',
        )}
      >
        {createSession.isPending
          ? t('chat.creating', { defaultValue: 'Creating...' })
          : t('chat.startSession', { defaultValue: 'Start session' })}
      </button>
    </div>
  );
}

/** Modal wrapper for LLMSelector */
export function NewSessionModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">
              {t('chat.newSession', { defaultValue: 'New chat session' })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('chat.newSessionDesc', {
                defaultValue:
                  'Choose the AI provider and model for this conversation.',
              })}
            </p>
          </div>
        </div>
        <LLMSelector onCreated={onClose} />
      </div>
    </div>
  );
}
