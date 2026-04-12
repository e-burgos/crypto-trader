import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Bot, User, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatMessageItem } from '../../hooks/use-chat';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface ChatMessagesProps {
  messages: ChatMessageItem[];
  streamingContent?: string;
  isStreaming?: boolean;
  provider?: string;
}

const PROVIDER_GLOW: Record<string, { avatar: string; glow: string }> = {
  CLAUDE: {
    avatar: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
    glow: 'shadow-[0_0_12px_hsl(25_95%_53%/0.25)]',
  },
  OPENAI: {
    avatar: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    glow: 'shadow-[0_0_12px_hsl(160_84%_39%/0.25)]',
  },
  GROQ: {
    avatar: 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30',
    glow: 'shadow-[0_0_12px_hsl(263_70%_50%/0.25)]',
  },
};

const DEFAULT_GLOW = {
  avatar: 'bg-primary/15 text-primary ring-1 ring-primary/30',
  glow: 'shadow-[0_0_12px_hsl(var(--primary)/0.2)]',
};

function ProviderAvatar({ provider }: { provider?: string }) {
  const style = PROVIDER_GLOW[provider ?? ''] ?? DEFAULT_GLOW;
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
        style.avatar,
        style.glow,
      )}
    >
      <Bot className="h-4 w-4" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="absolute right-2 top-2 rounded-lg p-1 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-muted"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground/70" />
      )}
    </button>
  );
}

function MessageBubble({
  message,
  provider,
}: {
  message: { role: string; content: string; createdAt: string };
  provider?: string;
}) {
  const isUser = message.role === 'USER';
  const ref = useRef<HTMLDivElement>(null);
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 14, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.32,
          ease: 'power2.out',
          clearProps: 'all',
        },
      );
    },
    { scope: ref },
  );

  if (isUser) {
    return (
      <div ref={ref} className="flex justify-end gap-2">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-primary/70 px-4 py-2.5 text-sm text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.3)]">
            {message.content}
          </div>
          <div className="mt-1 text-right text-[11px] text-muted-foreground/60">
            {time}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-border/50">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const { glow } = PROVIDER_GLOW[provider ?? ''] ?? DEFAULT_GLOW;

  return (
    <div ref={ref} className="flex gap-2.5">
      <ProviderAvatar provider={provider} />
      <div className="max-w-[85%]">
        <div
          className={cn(
            'group relative rounded-2xl rounded-tl-sm px-4 py-3 text-sm',
            'bg-muted/40',
            'ring-1 ring-border/60',
            glow,
          )}
        >
          <CopyButton text={message.content} />
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={cn('block', className)} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs ring-1 ring-border">
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">{children}</table>
                  </div>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground/60">{time}</div>
      </div>
    </div>
  );
}

function TypingBubble({ provider }: { provider?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="flex gap-2.5">
      <ProviderAvatar provider={provider} />
      <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot h-2 w-2 rounded-full bg-primary/80" />
          <span
            className="typing-dot h-2 w-2 rounded-full bg-primary/60"
            style={{ animationDelay: '0.18s' }}
          />
          <span
            className="typing-dot h-2 w-2 rounded-full bg-primary/40"
            style={{ animationDelay: '0.36s' }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  streamingContent,
  isStreaming,
  provider,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { glow } = PROVIDER_GLOW[provider ?? ''] ?? DEFAULT_GLOW;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  const visibleMessages = messages.filter((m) => m.role !== 'SYSTEM');

  // Once streaming ends, the session query reloads and the assistant message
  // appears in `messages`. Detect that to avoid showing the same text twice.
  const lastMsg = visibleMessages[visibleMessages.length - 1];
  const streamingIsDuplicate =
    !!streamingContent &&
    lastMsg?.role === 'ASSISTANT' &&
    lastMsg?.content === streamingContent;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4 scroll-smooth">
      {visibleMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} provider={provider} />
      ))}

      {/* Streaming assistant message — shown only while streaming finished but DB hasn't caught up */}
      {!isStreaming && !!streamingContent && !streamingIsDuplicate && (
        <div className="flex gap-2.5">
          <ProviderAvatar provider={provider} />
          <div className="max-w-[85%]">
            <div
              className={cn(
                'rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-white/10 backdrop-blur-sm',
                glow,
              )}
            >
              <span className="streaming-cursor">{streamingContent}</span>
            </div>
          </div>
        </div>
      )}

      {isStreaming && !streamingContent && <TypingBubble provider={provider} />}
      {isStreaming && streamingContent && (
        <div className="flex gap-2.5">
          <ProviderAvatar provider={provider} />
          <div className="max-w-[85%]">
            <div
              className={cn(
                'rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-white/10 backdrop-blur-sm',
                glow,
              )}
            >
              <span className="streaming-cursor">{streamingContent}</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
