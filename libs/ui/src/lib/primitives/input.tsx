import * as React from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, hint, error, leftIcon, rightIcon, id, type, ...props },
    ref,
  ) => {
    const inputId = id || React.useId();
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);

    const resolvedType = isPassword && showPassword ? 'text' : type;

    const passwordToggle = isPassword ? (
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    ) : null;

    const resolvedRightIcon = isPassword ? passwordToggle : rightIcon;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={resolvedType}
            className={cn(
              'flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors',
              'placeholder:text-muted-foreground/60',
              'focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error &&
                'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
              leftIcon && 'pl-10',
              (resolvedRightIcon || isPassword) && 'pr-10',
              className,
            )}
            {...props}
          />
          {resolvedRightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
              {resolvedRightIcon}
            </div>
          )}
        </div>
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
export type { InputProps };
