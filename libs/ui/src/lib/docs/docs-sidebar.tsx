import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '../utils';

export interface DocsSidebarLink {
  slug: string;
  label: string;
  icon?: React.ReactNode;
}

export interface DocsSidebarGroup {
  label: string;
  links: DocsSidebarLink[];
}

export interface DocsSidebarProps {
  groups: DocsSidebarGroup[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
  title?: string;
}

function SidebarNav({
  groups,
  activeSlug,
  onNavigate,
}: {
  groups: DocsSidebarGroup[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <nav className="space-y-5">
      {groups.map((group, gi) => {
        const isCollapsed = collapsedGroups.has(group.label);
        const hasActive = group.links.some((l) => l.slug === activeSlug);

        return (
          <div key={group.label}>
            {gi > 0 && <div className="mb-3 h-px bg-border/30" />}
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              className="mb-1.5 flex w-full items-center justify-between px-2"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {group.label}
              </p>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground/40 transition-transform duration-200',
                  isCollapsed ? '-rotate-90' : '',
                )}
              />
            </button>
            {!isCollapsed && (
              <ul className="space-y-0.5">
                {group.links.map((link) => {
                  const isActive = activeSlug === link.slug;
                  return (
                    <li key={link.slug}>
                      <button
                        type="button"
                        onClick={() => onNavigate(link.slug)}
                        className={cn(
                          'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150',
                          isActive
                            ? 'bg-primary/10 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        )}
                      >
                        {link.icon && (
                          <span
                            className={cn(
                              'shrink-0 transition-colors',
                              isActive
                                ? 'text-primary'
                                : 'text-muted-foreground/60 group-hover:text-muted-foreground',
                            )}
                          >
                            {link.icon}
                          </span>
                        )}
                        <span className="text-sm">{link.label}</span>
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function DocsSidebar({
  groups,
  activeSlug,
  onNavigate,
  title = 'Contents',
}: DocsSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside className="hidden md:flex sticky top-16 h-fit w-60 shrink-0 self-start">
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-6rem)] pr-4">
          <SidebarNav
            groups={groups}
            activeSlug={activeSlug}
            onNavigate={onNavigate}
          />
        </div>
        {/* Right divider */}
        <div className="w-px self-stretch bg-gradient-to-b from-transparent via-border/60 to-transparent" />
      </aside>

      {/* Mobile floating button + panel */}
      {createPortal(
        <>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[40] flex flex-col items-center justify-center gap-2 rounded-r-xl opacity-50 bg-gradient-to-br from-primary to-primary/80 backdrop-blur-sm px-2.5 py-4 text-primary-foreground shadow-lg hover:opacity-100 transition-opacity"
          >
            <Menu className="h-4 w-4 shrink-0 rotate-90" />
            <span className="text-xs font-semibold [writing-mode:vertical-rl] [text-orientation:mixed]">
              {title}
            </span>
          </button>

          {mobileOpen && (
            <div className="md:hidden fixed inset-0 z-[9999] flex">
              <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <div className="relative ml-auto w-72 h-full overflow-y-auto bg-card border-l border-border p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-sm">{title}</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SidebarNav
                  groups={groups}
                  activeSlug={activeSlug}
                  onNavigate={(slug) => {
                    onNavigate(slug);
                    setMobileOpen(false);
                  }}
                />
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
