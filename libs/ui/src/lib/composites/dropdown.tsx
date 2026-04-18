import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../utils';

/* ── Root ─────────────────────────────────────────────────────────────────── */

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function Dropdown({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className,
}: DropdownProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
            className,
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/* ── Item ─────────────────────────────────────────────────────────────────── */

interface DropdownItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
  className,
}: DropdownItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors',
        'focus:bg-muted/60',
        danger
          ? 'text-foreground hover:bg-red-500/10 hover:text-red-400 focus:text-red-400'
          : 'text-foreground hover:bg-muted/60',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {icon && (
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      )}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

/* ── Separator ────────────────────────────────────────────────────────────── */

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-border', className)}
    />
  );
}

/* ── Label ────────────────────────────────────────────────────────────────── */

export function DropdownLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50',
        className,
      )}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export type { DropdownProps, DropdownItemProps };
