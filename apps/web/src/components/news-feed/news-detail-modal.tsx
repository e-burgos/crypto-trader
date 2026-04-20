import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Brain,
  Sparkles,
  X,
  Calendar,
  User,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { type NewsItem, type AiHeadline } from '../../hooks/use-market';
import { timeAgo, sourceLabel, SENTIMENT_CONFIG } from './news-utils';

export function NewsDetailModal({
  item,
  aiResult,
  onClose,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onClose: () => void;
}) {
  const effectiveSentiment: NewsItem['sentiment'] =
    (aiResult?.sentiment as NewsItem['sentiment']) ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border shrink-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate flex-1">
            {sourceLabel(item.source)}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            {timeAgo(item.publishedAt)}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors ml-1 shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border',
                s.bg,
                s.color,
                s.border,
              )}
            >
              <SentimentIcon className="h-3.5 w-3.5" />
              {s.label}
            </span>
            {changed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                Reclasificado por IA
              </span>
            )}
          </div>

          <h2 className="text-base font-bold leading-snug">{item.headline}</h2>

          {item.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Resumen
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.summary}
              </p>
            </div>
          )}

          {!item.summary && (
            <p className="text-[12px] text-muted-foreground/50 italic">
              Esta fuente no provee resumen. Hacé clic en "Ver artículo" para
              leer el contenido completo.
            </p>
          )}

          {aiResult?.reasoning && (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary">
                  Análisis de IA
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {aiResult.reasoning}
              </p>
            </div>
          )}

          {item.author && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{item.author}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver artículo completo
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
