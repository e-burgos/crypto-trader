import { cn } from '../utils';

interface NavbarProps {
  logo: React.ReactNode;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function Navbar({
  logo,
  leftSlot,
  centerSlot,
  rightSlot,
  className,
}: NavbarProps) {
  return (
    <nav
      className={cn(
        'fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {logo}
          {leftSlot}
        </div>
        {centerSlot && <div className="hidden md:flex">{centerSlot}</div>}
        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>
    </nav>
  );
}

export type { NavbarProps };
