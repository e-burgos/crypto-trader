import type { InlineOption } from '../../hooks/use-chat';

interface ChatInlineOptionsProps {
  options: InlineOption[];
  onSelect: (option: InlineOption) => void;
  disabled?: boolean;
}

export function ChatInlineOptions({
  options,
  onSelect,
  disabled,
}: ChatInlineOptionsProps) {
  if (!options.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-10">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
