import * as React from 'react';
import { Dialog } from '../../composites/dialog';
import { cn } from '../../utils';

export interface ModelInfoData {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens?: number | null;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  categories: string[];
  supportedParameters: string[];
  description?: string;
}

export interface ModelInfoModalProps {
  open: boolean;
  onClose: () => void;
  model: ModelInfoData | null;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

function formatPrice(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'Free';
  if (pricePerMillion < 0.01) return `$${pricePerMillion.toFixed(4)}/M`;
  if (pricePerMillion < 0.1) return `$${pricePerMillion.toFixed(3)}/M`;
  if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}/M`;
  return `$${pricePerMillion.toFixed(1)}/M`;
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  free: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  paid: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  reasoning: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  'tool-use': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  fast: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  'long-context':
    'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  premium: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
};

const PARAM_COLORS: Record<string, string> = {
  reasoning: 'bg-violet-500/10 text-violet-400',
  tools: 'bg-blue-500/10 text-blue-400',
  include_reasoning: 'bg-violet-500/10 text-violet-300',
  temperature: 'bg-slate-500/10 text-slate-400',
  top_p: 'bg-slate-500/10 text-slate-400',
  top_k: 'bg-slate-500/10 text-slate-400',
  frequency_penalty: 'bg-slate-500/10 text-slate-400',
  presence_penalty: 'bg-slate-500/10 text-slate-400',
  repetition_penalty: 'bg-slate-500/10 text-slate-400',
  max_tokens: 'bg-slate-500/10 text-slate-400',
  stop: 'bg-slate-500/10 text-slate-400',
};

export function ModelInfoModal({ open, onClose, model }: ModelInfoModalProps) {
  if (!model) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={model.name}
      description={model.id}
      size="lg"
    >
      <div className="space-y-5">
        {/* Description */}
        {model.description && (
          <div className="max-h-24 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {model.description}
            </p>
          </div>
        )}

        {/* Key stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Context
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatTokens(model.contextLength)}
            </p>
          </div>
          {model.maxCompletionTokens && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Max Output
              </p>
              <p className="text-sm font-bold text-foreground">
                {formatTokens(model.maxCompletionTokens)}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Input Price
            </p>
            <p
              className={cn(
                'text-sm font-bold',
                model.isFree ? 'text-emerald-400' : 'text-foreground',
              )}
            >
              {formatPrice(model.pricing.prompt)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Output Price
            </p>
            <p
              className={cn(
                'text-sm font-bold',
                model.isFree ? 'text-emerald-400' : 'text-foreground',
              )}
            >
              {formatPrice(model.pricing.completion)}
            </p>
          </div>
        </div>

        {/* Categories */}
        {model.categories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {model.categories.map((cat) => (
                <Badge
                  key={cat}
                  className={
                    CATEGORY_COLORS[cat] ??
                    'bg-muted text-muted-foreground border border-border'
                  }
                >
                  {cat.replace(/-/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Supported parameters */}
        {model.supportedParameters.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Supported Parameters
            </p>
            <div className="flex flex-wrap gap-1.5">
              {model.supportedParameters.map((param) => (
                <Badge
                  key={String(param)}
                  className={
                    PARAM_COLORS[String(param)] ??
                    'bg-muted/50 text-muted-foreground'
                  }
                >
                  {String(param)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Model ID (copyable) */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Model ID
          </p>
          <code className="text-xs text-foreground font-mono break-all select-all">
            {model.id}
          </code>
        </div>
      </div>
    </Dialog>
  );
}
