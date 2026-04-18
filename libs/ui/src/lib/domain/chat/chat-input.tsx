import { useRef, useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '../../utils';
import type { ChatCapability } from './types';
import { CapabilityButtons } from './capability-buttons';

interface ChatInputProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  onSend: (content: string, capability?: ChatCapability) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  hasMessages?: boolean;
}

export function ChatInput({
  t,
  onSend,
  onStop,
  isStreaming,
  disabled,
  hasMessages,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const canSend = value.trim() && !disabled && !isStreaming;

  return (
    <div className="bg-transparent">
      {hasMessages && (
        <CapabilityButtons t={t} onSelect={(msg, cap) => onSend(msg, cap)} compact />
      )}

      <div className="px-3 pb-3 pt-2">
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-all duration-200',
            'bg-muted/30',
            focused
              ? 'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_16px_hsl(var(--primary)/0.15)]'
              : 'border-border/60 shadow-none',
          )}
        >
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled || isStreaming}
            placeholder={t('chat.inputPlaceholder', {
              defaultValue: 'Ask KRYPTO anything...',
            })}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm outline-none',
              'placeholder:text-muted-foreground/40',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-40 overflow-y-auto',
            )}
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
                'hover:bg-red-500/25 transition-all duration-150 active:scale-95',
              )}
              title={t('chat.stopStream', { defaultValue: 'Stop' })}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
                canSend
                  ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.6)] hover:scale-105 active:scale-95'
                  : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
              )}
              title="Send (Enter · Shift+Enter for newline)"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isStreaming && (
          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span
              className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/50"
              style={{ animationDelay: '0.18s' }}
            />
            <span
              className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/30"
              style={{ animationDelay: '0.36s' }}
            />
            <p className="text-[11px] text-muted-foreground/60">
              {t('chat.typing', { defaultValue: 'KRYPTO is thinking...' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
