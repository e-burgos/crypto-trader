import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils';

export interface DocsSearchPage {
  slug: string;
  title: string;
  description: string;
  group: string;
  keywords: string[];
}

export interface DocsSearchProps {
  pages: DocsSearchPage[];
  onSelect: (slug: string) => void;
  placeholder?: string;
  noResultsText?: string;
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // simple fuzzy: all chars of query appear in order in target
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreMatch(query: string, page: DocsSearchPage): number {
  const q = query.toLowerCase();
  let score = 0;
  if (page.title.toLowerCase().includes(q)) score += 10;
  if (page.title.toLowerCase().startsWith(q)) score += 5;
  if (page.description.toLowerCase().includes(q)) score += 3;
  if (page.keywords.some((k) => k.toLowerCase().includes(q))) score += 2;
  if (page.group.toLowerCase().includes(q)) score += 1;
  return score;
}

export function DocsSearch({
  pages,
  onSelect,
  placeholder = 'Search documentation...',
  noResultsText = 'No results found',
}: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results =
    query.trim().length > 0
      ? pages
          .filter(
            (p) =>
              fuzzyMatch(query, p.title) ||
              fuzzyMatch(query, p.description) ||
              p.keywords.some((k) => fuzzyMatch(query, k)),
          )
          .sort((a, b) => scoreMatch(query, b) - scoreMatch(query, a))
      : [];

  // Keyboard shortcut: / to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(
          (e.target as HTMLElement)?.tagName ?? '',
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset selected index on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        onSelect(results[selectedIndex].slug);
        setIsOpen(false);
        setQuery('');
      }
    },
    [results, selectedIndex, onSelect],
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground/60">
            /
          </kbd>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {noResultsText}
            </p>
          ) : (
            <ul className="py-1">
              {results.map((page, i) => (
                <li key={page.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(page.slug);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors',
                      i === selectedIndex
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {page.title}
                      </span>
                      <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {page.group}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {page.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
