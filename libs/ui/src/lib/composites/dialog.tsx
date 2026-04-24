import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../utils';

type DialogVariant = 'default' | 'confirm' | 'danger';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: DialogVariant;
  /** For confirm/danger variants */
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  variant = 'default',
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isPending = false,
  className,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-card p-6 shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            SIZE_CLASSES[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-4">{children}</div>

          {(variant === 'confirm' || variant === 'danger') && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50',
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary hover:bg-primary/90',
                )}
              >
                {isPending ? 'Loading...' : confirmLabel}
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type { DialogProps, DialogVariant };
