import { useEffect, useState, useCallback } from 'react';
import { cn } from '../utils';

export interface DocsTOCItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

export interface DocsTOCProps {
  /** Override auto-detected headings */
  items?: DocsTOCItem[];
  /** Container element to scan for headings (defaults to 'main') */
  contentSelector?: string;
  /** i18n title — defaults to "On this page" */
  title?: string;
  /**
   * Change this value on every navigation to re-trigger heading detection.
   * Typically pass the current route slug (e.g. activeSlug from DocsLayout).
   */
  triggerKey?: string;
}

export function DocsTOC({
  items: externalItems,
  contentSelector = '[data-docs-content]',
  title = 'On this page',
  triggerKey,
}: DocsTOCProps) {
  const [headings, setHeadings] = useState<DocsTOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Auto-detect headings from the rendered content.
  // Re-runs whenever triggerKey changes (i.e. on every docs navigation).
  // A small timeout lets the incoming Outlet fully render before we scan.
  useEffect(() => {
    if (externalItems) {
      setHeadings(externalItems);
      return;
    }

    setHeadings([]);
    setActiveId('');

    const timer = setTimeout(() => {
      const container = document.querySelector(contentSelector);
      if (!container) return;

      const els = container.querySelectorAll('h2[id], h3[id]');
      const detected: DocsTOCItem[] = Array.from(els).map((el) => ({
        id: el.id,
        text: el.textContent?.replace(/^#\s*/, '').trim() ?? '',
        level: el.tagName === 'H2' ? 2 : 3,
      }));
      setHeadings(detected);
    }, 80);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalItems, contentSelector, triggerKey]);

  // navbar h-14 = 56px + 16px breathing room
  const HEADER_OFFSET = 72;

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: `-${HEADER_OFFSET}px 0px -60% 0px` },
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        const top =
          el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top, behavior: 'smooth' });
        window.history.replaceState(null, '', `#${id}`);
      }
    },
    [HEADER_OFFSET],
  );

  if (headings.length === 0) return null;

  return (
    <nav className="hidden xl:block sticky top-16 h-fit w-52 shrink-0 self-start">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <ul className="space-y-0.5 border-l border-border/40">
        {headings.map(({ id, text, level }) => {
          const isActive = activeId === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollTo(id)}
                className={cn(
                  'block w-full text-left text-[13px] leading-snug transition-all duration-150',
                  level === 3 ? 'pl-6 pr-2 py-1' : 'pl-3 pr-2 py-1',
                  isActive
                    ? 'border-l-2 border-primary -ml-px text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
