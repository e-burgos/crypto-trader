import { cn } from '../utils';

interface NavbarDocsProps {
  /** Logo / brand element (left side) */
  logo: React.ReactNode;
  /** Documentation title shown next to the logo */
  title?: string;
  /** Center slot — typically the search component */
  centerSlot?: React.ReactNode;
  /** Right slot — auth controls, theme toggle, etc. */
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * Navbar variant designed for documentation pages.
 * Combines site navigation with an integrated search bar in a single sticky header,
 * avoiding the overlap caused by stacking the generic Navbar + a separate docs header.
 */
export function NavbarDocs({
  logo,
  title,
  centerSlot,
  rightSlot,
  className,
}: NavbarDocsProps) {
  return (
    <nav
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left — Logo + docs title */}
        <div className="flex items-center gap-3 shrink-0">
          {logo}
          {title && (
            <>
              <span className="hidden sm:block h-5 w-px bg-border/60" />
              <span className="hidden sm:block text-sm font-semibold text-muted-foreground">
                {title}
              </span>
            </>
          )}
        </div>

        {/* Center — Search */}
        {centerSlot && (
          <div className="flex-1 flex justify-center">{centerSlot}</div>
        )}

        {/* Right — Actions */}
        <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>
      </div>
    </nav>
  );
}

export type { NavbarDocsProps };
