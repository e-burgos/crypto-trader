import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  GitCommitVertical,
  RotateCcw,
  SeparatorHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatLLMOptions, LLMOption } from '../../hooks/use-chat';
import { useChatStore } from '../../store/chat.store';
import { useTranslation } from 'react-i18next';

const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: 'text-orange-400',
  OPENAI: 'text-emerald-400',
  GROQ: 'text-violet-400',
  GEMINI: 'text-blue-400',
  MISTRAL: 'text-orange-500',
  TOGETHER: 'text-cyan-400',
};

interface ChatLLMOverrideProps {
  /** Current session provider */
  sessionProvider: string;
  /** Current session model */
  sessionModel: string;
}

export function ChatLLMOverride({
  sessionProvider,
  sessionModel,
}: ChatLLMOverrideProps) {
  const { t } = useTranslation();
  const { data: options = [] } = useChatLLMOptions();
  const {
    sessionProvider: overrideProvider,
    sessionModel: overrideModel,
    setSessionLLM,
  } = useChatStore();

  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const activeProvider = overrideProvider ?? sessionProvider;
  const activeOption = options.find((o) => o.provider === activeProvider);
  const activeModel = overrideModel ?? sessionModel;
  const isOverridden = overrideProvider !== null || overrideModel !== null;
  const availableModels = activeOption?.models ?? [];

  const handleProviderSelect = (opt: LLMOption) => {
    setSessionLLM(opt.provider, opt.models[0] ?? sessionModel);
    setProviderOpen(false);
  };

  const handleModelSelect = (model: string) => {
    setSessionLLM(overrideProvider ?? sessionProvider, model);
    setModelOpen(false);
  };

  const handleReset = () => {
    setSessionLLM(null, null);
  };

  if (options.length <= 1) return null;

  return (
    <div ref={containerRef} className="flex items-center gap-1 px-3 pb-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {t('chat.llmOverride.label', { defaultValue: 'Model' })}
      </span>

      {/* Provider selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setProviderOpen(!providerOpen);
            setModelOpen(false);
          }}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
            'hover:bg-muted/50',
            isOverridden ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <span
            className={
              PROVIDER_COLORS[activeProvider] ?? 'text-muted-foreground'
            }
          >
            {activeOption?.label ?? activeProvider}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>

        {providerOpen && (
          <div className="absolute bg-background bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.provider}
                type="button"
                onClick={() => handleProviderSelect(opt)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                  'hover:bg-muted/60',
                  opt.provider === activeProvider && 'bg-muted/40 font-medium',
                )}
              >
                <span className={PROVIDER_COLORS[opt.provider] ?? ''}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setModelOpen(!modelOpen);
            setProviderOpen(false);
          }}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
            'hover:bg-muted/50',
            isOverridden ? 'text-primary font-medium' : 'text-muted-foreground',
          )}
        >
          <span className="max-w-[120px] truncate">{activeModel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>

        {modelOpen && availableModels.length > 0 && (
          <div className="absolute bg-background bottom-full left-0 z-50 mb-1 max-h-48 min-w-[180px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {availableModels.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModelSelect(m)}
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors',
                  'hover:bg-muted/60',
                  m === activeModel && 'bg-muted/40 font-medium',
                )}
              >
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reset button */}
      {isOverridden && (
        <button
          type="button"
          onClick={handleReset}
          title={t('chat.llmOverride.reset', {
            defaultValue: 'Reset to session default',
          })}
          className="ml-0.5 rounded-md p-0.5 text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
